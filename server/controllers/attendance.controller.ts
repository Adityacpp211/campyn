import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { attendanceService } from '../services/attendance.service';
import {
  recordAttendanceSchema,
  attendanceCorrectionSchema,
  updateAttendanceRecordSchema,
} from '../validators/attendance.validator';

export class AttendanceController {
  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sectionCourseId, date, facultyId, status } = req.query as {
        sectionCourseId?: string;
        date?: string;
        facultyId?: string;
        status?: string;
      };
      const sessions = await attendanceService.getSessions(req.user!, {
        sectionCourseId,
        date,
        facultyId,
        status,
      });
      res.json({
        success: true,
        data: sessions,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSessionRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const records = await attendanceService.getSessionRecords(req.params.sessionId as string);
      res.json({
        success: true,
        data: records,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async recordAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = recordAttendanceSchema.parse(req.body);
      const result = await attendanceService.recordAttendance(
        req.user!,
        validatedInput,
        req.ip || '127.0.0.1'
      );
      res.status(201).json({
        success: true,
        data: result,
        message: 'Attendance recorded successfully',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async lockSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const locked = await attendanceService.lockSession(
        req.user!,
        req.params.id as string,
        req.ip || '127.0.0.1'
      );
      res.json({
        success: true,
        data: locked,
        message: 'Attendance session successfully locked and finalized',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateAttendanceRecordSchema.parse(req.body);
      const updated = await attendanceService.updateRecord(
        req.user!,
        req.params.id as string,
        validated.status,
        validated.reason,
        req.ip || '127.0.0.1'
      );
      res.json({
        success: true,
        data: updated,
        message: 'Attendance record updated successfully with cryptographic audit logging',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }


  async requestCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = attendanceCorrectionSchema.parse(req.body);
      const result = await attendanceService.requestCorrection(
        req.user!,
        validatedInput,
        req.ip || '127.0.0.1'
      );
      res.status(201).json({
        success: true,
        data: result,
        message: 'Correction request submitted for approval',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getStudentStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.query.studentId as string | undefined;
      const stats = await attendanceService.getStudentStats(req.user!, studentId);
      res.json({
        success: true,
        data: stats,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getDepartmentStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const stats = await attendanceService.getDepartmentStats(req.user!, departmentId);
      res.json({
        success: true,
        data: stats,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const attendanceController = new AttendanceController();
