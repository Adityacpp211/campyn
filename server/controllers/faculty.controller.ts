import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { facultyService } from '../services/faculty.service';
import {
  facultyCreateSchema,
  facultyUpdateSchema,
  facultyAssignSchema,
  facultyQuerySchema,
} from '../validators/faculty.validator';

export class FacultyController {
  async getFacultyList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = facultyQuerySchema.parse(req.query);
      const result = await facultyService.getFacultyList(req.user!.institutionId, query);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getFacultyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await facultyService.getFacultyById(req.params.id as string, req.user!.institutionId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createFaculty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = facultyCreateSchema.parse(req.body);
      const data = await facultyService.createFaculty(req.user!, validated);
      res.status(201).json({ success: true, message: 'Faculty created successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async updateFaculty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = facultyUpdateSchema.parse(req.body);
      const data = await facultyService.updateFaculty(req.user!, req.params.id as string, validated);
      res.json({ success: true, message: 'Faculty updated successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async assignFaculty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = facultyAssignSchema.parse(req.body);
      const data = await facultyService.assignFaculty(req.user!, validated);
      res.json({ success: true, message: 'Faculty assigned to section course', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async unassignFaculty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await facultyService.unassignFaculty(req.user!, req.params.sectionCourseId as string);
      res.json({ success: true, message: 'Faculty unassigned from section course', requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
}

export const facultyController = new FacultyController();
