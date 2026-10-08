import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { requestIdMiddleware } from './middleware/requestId';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { studentsRouter } from './routes/students.routes';
import { facultyRouter } from './routes/faculty.routes';
import { academicsRouter } from './routes/academics.routes';
import { attendanceRouter } from './routes/attendance.routes';
import { feesRouter } from './routes/fees.routes';
import { approvalsRouter } from './routes/approvals.routes';
import { auditRouter } from './routes/audit.routes';
import { timetableRouter } from './routes/timetable.routes';
import { assignmentsRouter } from './routes/assignments.routes';
import { examsRouter } from './routes/exams.routes';
import { dashboardRouter } from './routes/dashboard.routes';
import { getDb, dbClient } from './db';
import { runMigrations } from './db/migrate';
import { structuredLogger } from './middleware/logger';
import os from 'os';

export const app = express();

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow development inline assets
}));
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map(s => s.trim()),
  credentials: true,
}));
app.use(express.json());
app.use(requestIdMiddleware);
app.use(structuredLogger);

// Rate limiting
app.use('/api', apiLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/auth/login', authLimiter);

// Health and Readiness Check Endpoints
app.get(['/health', '/api/health'], async (_req, res) => {
  res.json({
    status: 'healthy',
    system: 'CAMPYN V2 Enterprise Operating System',
    timestamp: new Date().toISOString(),
  });
});

app.get(['/readiness', '/api/readiness'], async (_req, res) => {
  try {
    // Probe database connectivity
    await dbClient.query('SELECT 1');
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// Domain router registration function
function mountRoutes(prefix: string) {
  app.use(`${prefix}/auth`, authRouter);
  app.use(`${prefix}/students`, studentsRouter);
  app.use(`${prefix}/faculty`, facultyRouter);
  app.use(`${prefix}/academics`, academicsRouter);
  app.use(`${prefix}/attendance`, attendanceRouter);
  app.use(`${prefix}/fees`, feesRouter);
  app.use(`${prefix}/approvals`, approvalsRouter);
  app.use(`${prefix}/audit`, auditRouter);
  app.use(`${prefix}/timetable`, timetableRouter);
  app.use(`${prefix}/assignments`, assignmentsRouter);
  app.use(`${prefix}/exams`, examsRouter);
  app.use(`${prefix}/dashboard`, dashboardRouter);
}

// Mount versioned API routes (/api/v1) and legacy routes (/api)
mountRoutes('/api/v1');
mountRoutes('/api');

// Global Error Handler
app.use(errorHandler);

export async function startServer(): Promise<any> {
  await getDb();
  await runMigrations();

  return new Promise((resolve) => {
    const server = app.listen(config.port, config.host, () => {
      console.log(`[CAMPYN V2 API] Running on http://${config.host}:${config.port} (${config.nodeEnv})`);

      // Show LAN address for multi-device access
      if (config.host === '0.0.0.0') {
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
          for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
              console.log(`[CAMPYN V2 API] LAN access: http://${net.address}:${config.port}`);
            }
          }
        }
        console.log(`[CAMPYN V2 API] To expose online, run: npx cloudflared tunnel --url http://localhost:${config.port}`);
      }

      resolve(server);
    });
  });
}

// Direct execution
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  startServer().catch((err) => {
    console.error('[CAMPYN V2 API] Server startup error:', err);
    process.exit(1);
  });
}
