import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { examController } from '../controllers/exam.controller';

export const examsRouter = Router();

examsRouter.use(authenticateToken);

// GET /api/v1/exams
examsRouter.get('/', requirePermission('marks.read'), examController.getExams.bind(examController));

// POST /api/v1/exams (Create examination session)
examsRouter.post('/', requirePermission('marks.lock_publish'), examController.createExam.bind(examController));

// GET /api/v1/exams/:id/marks
examsRouter.get('/:id/marks', requirePermission('marks.read'), examController.getMarks.bind(examController));

// POST /api/v1/exams/:id/populate-roster (Auto-populate marks roster for course)
examsRouter.post('/:id/populate-roster', requirePermission('marks.enter'), examController.populateRoster.bind(examController));

// PUT /api/v1/exams/marks/:id (Update single marks entry with audit trail)
examsRouter.put('/marks/:id', requirePermission('marks.enter'), examController.updateMarks.bind(examController));

// POST /api/v1/exams/:id/lock or /:id/toggle-lock
examsRouter.post(['/:id/lock', '/:id/toggle-lock'], requirePermission('marks.lock_publish'), examController.toggleLock.bind(examController));
