import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { feeService } from '../services/fee.service';
import { processPaymentSchema, refundFeeSchema } from '../validators/fee.validator';

export class FeeController {
  async getDues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.query.studentId as string | undefined;
      const dues = await feeService.getStudentDues(req.user!, studentId);
      res.json({
        success: true,
        data: dues,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.query.studentId as string | undefined;
      const transactions = await feeService.getTransactions(req.user!, studentId);
      res.json({
        success: true,
        data: transactions,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async processPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = processPaymentSchema.parse(req.body);
      const result = await feeService.processPayment(
        req.user!,
        validatedInput,
        req.ip || '127.0.0.1'
      );
      res.status(201).json({
        success: true,
        data: result,
        message: 'Payment processed and receipt generated',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async refundFee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = refundFeeSchema.parse(req.body);
      const result = await feeService.processRefund(
        req.user!,
        validatedInput,
        req.ip || '127.0.0.1'
      );
      res.json({
        success: true,
        data: result,
        message: 'Refund successfully completed and balance restored',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const feeController = new FeeController();
