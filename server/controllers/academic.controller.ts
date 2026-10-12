import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { academicService } from '../services/academic.service';
import {
  departmentCreateSchema,
  departmentUpdateSchema,
  programCreateSchema,
  academicYearCreateSchema,
  semesterCreateSchema,
  sectionCreateSchema,
} from '../validators/academic.validator';

export class AcademicController {
  // Departments
  async getDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await academicService.getDepartments(req.user!.institutionId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async getDepartmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await academicService.getDepartmentById(req.params.id as string, req.user!.institutionId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async getDepartmentStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await academicService.getDepartmentStats(req.params.id as string, req.user!.institutionId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = departmentCreateSchema.parse(req.body);
      const data = await academicService.createDepartment(req.user!, validated);
      res.status(201).json({ success: true, message: 'Department created successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = departmentUpdateSchema.parse(req.body);
      const data = await academicService.updateDepartment(req.user!, req.params.id as string, validated);
      res.json({ success: true, message: 'Department updated successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async archiveDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await academicService.archiveDepartment(req.user!, req.params.id as string);
      res.json({ success: true, message: 'Department archived successfully', requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  // Programs
  async getPrograms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = req.query.departmentId as string | undefined;
      const data = await academicService.getPrograms(req.user!.institutionId, departmentId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = programCreateSchema.parse(req.body);
      const data = await academicService.createProgram(req.user!, validated);
      res.status(201).json({ success: true, message: 'Program created successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  // Academic Years
  async getAcademicYears(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await academicService.getAcademicYears(req.user!.institutionId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createAcademicYear(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = academicYearCreateSchema.parse(req.body);
      const data = await academicService.createAcademicYear(req.user!, validated);
      res.status(201).json({ success: true, message: 'Academic Year created successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  // Semesters
  async getSemesters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const academicYearId = req.query.academicYearId as string | undefined;
      const data = await academicService.getSemesters(academicYearId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createSemester(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = semesterCreateSchema.parse(req.body);
      const data = await academicService.createSemester(req.user!, validated);
      res.status(201).json({ success: true, message: 'Semester created successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  // Sections
  async getSections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const programId = req.query.programId as string | undefined;
      const semesterId = req.query.semesterId as string | undefined;
      const data = await academicService.getSections(req.user!.institutionId, programId, semesterId);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = sectionCreateSchema.parse(req.body);
      const data = await academicService.createSection(req.user!, validated);
      res.status(201).json({ success: true, message: 'Section created successfully', data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }
}

export const academicController = new AcademicController();
