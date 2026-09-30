import { Request, Response, NextFunction } from 'express';
import { assignmentService } from '../services/assignment.service';
import {
  createAssignmentSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
} from '../validators/assignment.validator';

export class AssignmentController {
  async getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sectionCourseId, courseId } = req.query as { sectionCourseId?: string; courseId?: string };
      const assignments = await assignmentService.getAssignments(req.user!, {
        sectionCourseId,
        courseId,
      });
      res.json({
        success: true,
        data: assignments,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async createAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createAssignmentSchema.parse(req.body);
      const assignment = await assignmentService.createAssignment(
        req.user!,
        validated,
        req.ip || '127.0.0.1'
      );
      res.status(201).json({
        success: true,
        data: assignment,
        message: 'Assignment created successfully',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const submissions = await assignmentService.getSubmissions(req.user!, req.params.id);
      res.json({
        success: true,
        data: submissions,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async submitAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = submitAssignmentSchema.parse(req.body);
      const submission = await assignmentService.submitAssignment(
        req.user!,
        req.params.id,
        validated,
        req.ip || '127.0.0.1'
      );
      res.status(201).json({
        success: true,
        data: submission,
        message: 'Assignment deliverable submitted successfully',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async gradeSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = gradeSubmissionSchema.parse(req.body);
      const result = await assignmentService.gradeSubmission(
        req.user!,
        req.params.id,
        validated,
        req.ip || '127.0.0.1'
      );
      res.json({
        success: true,
        data: result,
        message: 'Submission graded successfully with audit trail',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const assignmentController = new AssignmentController();
