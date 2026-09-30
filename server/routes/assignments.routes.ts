import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { assignmentController } from '../controllers/assignment.controller';

export const assignmentsRouter = Router();

assignmentsRouter.use(authenticateToken);

// GET /api/v1/assignments
assignmentsRouter.get('/', requirePermission('assignments.read'), assignmentController.getAssignments.bind(assignmentController));

// POST /api/v1/assignments
assignmentsRouter.post('/', requirePermission('assignments.create'), assignmentController.createAssignment.bind(assignmentController));

// GET /api/v1/assignments/:id/submissions
assignmentsRouter.get('/:id/submissions', requirePermission('assignments.read'), assignmentController.getSubmissions.bind(assignmentController));

// POST /api/v1/assignments/:id/submit
assignmentsRouter.post('/:id/submit', requirePermission('assignments.submit'), assignmentController.submitAssignment.bind(assignmentController));

// PUT /api/v1/assignments/submissions/:id/grade
assignmentsRouter.put('/submissions/:id/grade', requirePermission('assignments.grade'), assignmentController.gradeSubmission.bind(assignmentController));
