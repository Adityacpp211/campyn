import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { enforceTenantIsolation } from '../middleware/tenantIsolation';
import { requireAnyPermission } from '../middleware/rbac';
import { academicController } from '../controllers/academic.controller';
import { courseController } from '../controllers/course.controller';

export const academicsRouter = Router();

academicsRouter.use(authenticateToken);
academicsRouter.use(enforceTenantIsolation);

// --- DEPARTMENTS ---
academicsRouter.get('/departments', (req, res, next) => academicController.getDepartments(req, res, next));
academicsRouter.get('/departments/:id', (req, res, next) => academicController.getDepartmentById(req, res, next));
academicsRouter.get('/departments/:id/stats', (req, res, next) => academicController.getDepartmentStats(req, res, next));
academicsRouter.post('/departments', requireAnyPermission(['departments.manage', 'courses.create']), (req, res, next) => academicController.createDepartment(req, res, next));
academicsRouter.put('/departments/:id', requireAnyPermission(['departments.manage', 'courses.create']), (req, res, next) => academicController.updateDepartment(req, res, next));
academicsRouter.delete('/departments/:id', requireAnyPermission(['departments.manage', 'courses.create']), (req, res, next) => academicController.archiveDepartment(req, res, next));

// --- PROGRAMS ---
academicsRouter.get('/programs', (req, res, next) => academicController.getPrograms(req, res, next));
academicsRouter.post('/programs', requireAnyPermission(['departments.manage', 'courses.create']), (req, res, next) => academicController.createProgram(req, res, next));

// --- ACADEMIC YEARS ---
academicsRouter.get('/academic-years', (req, res, next) => academicController.getAcademicYears(req, res, next));
academicsRouter.post('/academic-years', requireAnyPermission(['departments.manage', 'courses.create']), (req, res, next) => academicController.createAcademicYear(req, res, next));

// --- SEMESTERS ---
academicsRouter.get('/semesters', (req, res, next) => academicController.getSemesters(req, res, next));
academicsRouter.post('/semesters', requireAnyPermission(['departments.manage', 'courses.create']), (req, res, next) => academicController.createSemester(req, res, next));

// --- SECTIONS ---
academicsRouter.get('/sections', (req, res, next) => academicController.getSections(req, res, next));
academicsRouter.post('/sections', requireAnyPermission(['departments.manage', 'courses.create']), (req, res, next) => academicController.createSection(req, res, next));

// --- COURSES & OFFERINGS ---
academicsRouter.get('/courses', (req, res, next) => courseController.getCourses(req, res, next));
academicsRouter.get('/courses/offerings', (req, res, next) => courseController.getCourseOfferings(req, res, next));
academicsRouter.get('/courses/:id', (req, res, next) => courseController.getCourseById(req, res, next));
academicsRouter.post('/courses', requireAnyPermission(['courses.create', 'departments.manage']), (req, res, next) => courseController.createCourse(req, res, next));
academicsRouter.put('/courses/:id', requireAnyPermission(['courses.update', 'departments.manage']), (req, res, next) => courseController.updateCourse(req, res, next));
academicsRouter.delete('/courses/:id', requireAnyPermission(['courses.update', 'departments.manage']), (req, res, next) => courseController.archiveCourse(req, res, next));
