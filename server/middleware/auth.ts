import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { dbClient } from '../db';

export interface AuthUser {
  id: string;
  sessionId?: string;
  institutionId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  departmentId?: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or malformed',
        requestId: req.id,
      },
    });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      sessionId?: string;
    };

    // 1. Check session revocation if sessionId is present
    if (payload.sessionId) {
      const sessRes = await dbClient.query(`
        SELECT id, revoked_at, expires_at 
        FROM user_sessions 
        WHERE id = $1
      `, [payload.sessionId]);

      if (sessRes.rows.length === 0 || sessRes.rows[0].revoked_at) {
        res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_REVOKED',
            message: 'Session has been revoked or expired. Please sign in again.',
            requestId: req.id,
          },
        });
        return;
      }
    }

    // 2. Fetch user details, role, institution, department, and permissions from DB
    const userRes = await dbClient.query(`
      SELECT 
        u.id, u.institution_id, u.email, u.username, u.first_name, u.last_name, u.is_active,
        r.code as role_code,
        f.department_id as faculty_dept_id,
        COALESCE(
          (
            SELECT json_agg(p.code)
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = r.id
          ),
          '[]'::json
        ) as permissions
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN faculty f ON f.user_id = u.id
      WHERE u.id = $1
    `, [payload.userId]);

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_DEACTIVATED',
          message: 'Account is inactive or does not exist',
          requestId: req.id,
        },
      });
      return;
    }

    const row = userRes.rows[0];
    req.user = {
      id: row.id,
      sessionId: payload.sessionId,
      institutionId: row.institution_id,
      email: row.email,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role_code || 'STUDENT',
      departmentId: row.faculty_dept_id,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Authentication token has expired or is invalid',
        requestId: req.id,
      },
    });
  }
}
