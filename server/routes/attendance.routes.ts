import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission, requireAnyPermission } from '../middleware/rbac';
import { enforceTenantIsolation } from '../middleware/tenantIsolation';
import { attendanceController } from '../controllers/attendance.controller';

export const attendanceRouter = Router();

attendanceRouter.use(authenticateToken);
attendanceRouter.use(enforceTenantIsolation);

// GET /api/v1/attendance/sessions - List attendance sessions
attendanceRouter.get(
  '/sessions',
  requirePermission('attendance.read'),
  attendanceController.getSessions.bind(attendanceController)
);

// GET /api/v1/attendance/records - Query records
attendanceRouter.get(
  '/records',
  requirePermission('attendance.read'),
  (req, res, next) => {
    if (req.query.sessionId) {
      req.params.sessionId = req.query.sessionId as string;
      return attendanceController.getSessionRecords(req, res, next);
    }
    return res.json({ success: true, data: [], requestId: req.id });
  }
);

// GET /api/v1/attendance/stats - Server-side attendance percentages & shortage alerts
attendanceRouter.get(
  '/stats',
  requirePermission('attendance.read'),
  attendanceController.getStudentStats.bind(attendanceController)
);

// GET /api/v1/attendance/department-stats - HOD / Admin department stats & shortage lists
attendanceRouter.get(
  '/department-stats',
  requireAnyPermission(['departments.manage', 'attendance.approve']),
  attendanceController.getDepartmentStats.bind(attendanceController)
);

// POST /api/v1/attendance/sessions - Record attendance session
attendanceRouter.post(
  '/sessions',
  requirePermission('attendance.record'),
  attendanceController.recordAttendance.bind(attendanceController)
);

// POST /api/v1/attendance/sessions/:id/lock - Lock and finalize attendance session
attendanceRouter.post(
  '/sessions/:id/lock',
  requireAnyPermission(['attendance.approve', 'departments.manage']),
  attendanceController.lockSession.bind(attendanceController)
);

// PUT /api/v1/attendance/records/:id - Modifies record (rejects if session is LOCKED)
attendanceRouter.put(
  '/records/:id',
  requireAnyPermission(['attendance.record', 'attendance.approve']),
  attendanceController.updateRecord.bind(attendanceController)
);

// POST /api/v1/attendance/corrections - Request correction for locked/finalized record
attendanceRouter.post(
  '/corrections',
  requirePermission('attendance.correct'),
  attendanceController.requestCorrection.bind(attendanceController)
);
