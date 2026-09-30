import { z } from 'zod';

export const createAssignmentSchema = z.object({
  sectionCourseId: z.string().uuid({ message: 'Valid sectionCourseId UUID required' }),
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }).max(255),
  description: z.string().optional().default(''),
  maxMarks: z.coerce.number().positive({ message: 'Max marks must be a positive number' }).max(1000),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Valid ISO due date string required' }),
  allowLate: z.boolean().optional().default(false),
});

export const submitAssignmentSchema = z.object({
  fileUrl: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const gradeSubmissionSchema = z.object({
  marksAwarded: z.coerce.number().min(0, { message: 'Marks awarded must be non-negative' }),
  feedback: z.string().optional().default(''),
  reason: z.string().min(5, { message: 'Mandatory justification reason required for grading audit' }),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
