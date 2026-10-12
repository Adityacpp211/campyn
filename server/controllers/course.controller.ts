import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { courseService } from '../services/course.service';
import { courseCreateSchema, courseUpdateSchema, courseQuerySchema } from '../validators/course.validator';

export class CourseController {
  async getCourses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = courseQuerySchema.parse(req.query);
      const result = await courseService.getCourses(req.user!.institutionId, query);
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

  async getCourseById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await courseService.getCourseById(req.params.id as string, req.user!.institutionId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = courseCreateSchema.parse(req.body);
      const data = await courseService.createCourse(req.user!, validated);
      res.status(201).json({ success: true, message: 'Course created successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async updateCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = courseUpdateSchema.parse(req.body);
      const data = await courseService.updateCourse(req.user!, req.params.id as string, validated);
      res.json({ success: true, message: 'Course updated successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async archiveCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await courseService.archiveCourse(req.user!, req.params.id as string);
      res.json({ success: true, message: 'Course archived successfully', requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async getCourseOfferings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const courseId = req.query.courseId as string | undefined;
      const sectionId = req.query.sectionId as string | undefined;
      const data = await courseService.getCourseOfferings(req.user!.institutionId, courseId, sectionId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
}

export const courseController = new CourseController();
