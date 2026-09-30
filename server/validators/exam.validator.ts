import { z } from 'zod';

export const createExamSchema = z.object({
  semesterId: z.string().uuid({ message: 'Valid semesterId UUID required' }),
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }).max(255),
  examType: z.enum(['internal', 'midterm', 'final', 'lab'], {
    errorMap: () => ({ message: 'Exam type must be internal, midterm, final, or lab' }),
  }),
});

export const updateMarksSchema = z.object({
  marksObtained: z.coerce.number().min(0, { message: 'Marks obtained must be non-negative' }),
  grade: z.string().optional(),
  reason: z.string().min(5, { message: 'Mandatory justification reason required for grade revision' }),
});

export const populateRosterSchema = z.object({
  courseId: z.string().uuid({ message: 'Valid courseId UUID required' }),
  maxMarks: z.coerce.number().positive({ message: 'Max marks must be greater than zero' }).default(50),
});

export const batchMarksEntrySchema = z.object({
  entries: z.array(
    z.object({
      id: z.string().uuid({ message: 'Valid marks entry ID required' }),
      marksObtained: z.coerce.number().min(0),
      grade: z.string().optional(),
    })
  ).min(1, { message: 'At least one marks entry required' }),
  reason: z.string().min(5, { message: 'Mandatory justification reason required for batch marks update' }),
});

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateMarksInput = z.infer<typeof updateMarksSchema>;
export type PopulateRosterInput = z.infer<typeof populateRosterSchema>;
export type BatchMarksEntryInput = z.infer<typeof batchMarksEntrySchema>;
