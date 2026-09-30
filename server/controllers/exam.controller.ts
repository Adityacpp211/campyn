import { Request, Response, NextFunction } from 'express';
import { examService } from '../services/exam.service';
import {
  createExamSchema,
  updateMarksSchema,
  populateRosterSchema,
} from '../validators/exam.validator';

export class ExamController {
  async getExams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exams = await examService.getExams(req.user!);
      res.json({
        success: true,
        data: exams,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async createExam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createExamSchema.parse(req.body);
      const exam = await examService.createExam(req.user!, validated, req.ip || '127.0.0.1');
      res.status(201).json({
        success: true,
        data: exam,
        message: 'Examination created successfully',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const marks = await examService.getMarks(req.user!, req.params.id);
      res.json({
        success: true,
        data: marks,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async populateRoster(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = populateRosterSchema.parse(req.body);
      const result = await examService.populateRoster(
        req.user!,
        req.params.id,
        validated,
        req.ip || '127.0.0.1'
      );
      res.status(201).json({
        success: true,
        data: result,
        message: 'Examination roster successfully populated from enrolled student cohort',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateMarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateMarksSchema.parse(req.body);
      const result = await examService.updateMarks(
        req.user!,
        req.params.id,
        validated,
        req.ip || '127.0.0.1'
      );
      res.json({
        success: true,
        data: result,
        message: 'Marks entry updated with cryptographic audit trail',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async toggleLock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const outcome = await examService.toggleLock(req.user!, req.params.id, req.ip || '127.0.0.1');
      res.json({
        success: true,
        data: outcome,
        message: 'Examination lock status updated',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const examController = new ExamController();
