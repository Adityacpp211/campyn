import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { timetableService } from '../services/timetable.service';
import { timetableSlotCreateSchema, timetableQuerySchema } from '../validators/timetable.validator';

export class TimetableController {
  async getTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = timetableQuerySchema.parse(req.query);
      const data = await timetableService.getTimetable(req.user!.institutionId, query);
      res.json({ success: true, data, requestId: req.id });
    } catch (err) {
      next(err);
    }
  }

  async createSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = timetableSlotCreateSchema.parse(req.body);
      const data = await timetableService.createSlot(req.user!, validated);
      res.status(201).json({
        success: true,
        message: 'Timetable slot created successfully',
        data,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await timetableService.deleteSlot(req.user!, req.params.id as string);
      res.json({
        success: true,
        message: 'Timetable slot deleted successfully',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const timetableController = new TimetableController();
