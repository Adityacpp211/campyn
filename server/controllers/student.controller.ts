import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { studentService } from '../services/student.service';
import {
  studentQuerySchema,
  createStudentSchema,
  sectionTransferSchema,
  updateStudentSchema,
} from '../validators/student.validator';

export class StudentController {
  async getStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedQuery = studentQuerySchema.parse(req.query);
      const result = await studentService.getStudents(req.user!, validatedQuery);
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

  async getStudentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await studentService.getStudentById(req.user!, req.params.id as string);
      res.json({
        success: true,
        data: student,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const student = await studentService.getStudentProfile(req.user!);
      res.json({
        success: true,
        data: student,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async createStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createStudentSchema.parse(req.body);
      const data = await studentService.createStudent(req.user!, validated);
      res.status(201).json({
        success: true,
        message: 'Student enrolled and registered successfully',
        data,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async transferSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = sectionTransferSchema.parse(req.body);
      const data = await studentService.transferSection(req.user!, req.params.id as string, validated);
      res.json({
        success: true,
        message: 'Student section transferred and course enrollments updated',
        data,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = updateStudentSchema.parse(req.body);
      const data = await studentService.updateStudent(req.user!, req.params.id as string, validated);
      res.json({
        success: true,
        message: 'Student profile updated successfully',
        data,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const studentController = new StudentController();
