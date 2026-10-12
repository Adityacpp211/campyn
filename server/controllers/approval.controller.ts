import { Request, Response, NextFunction } from 'express';
import '../middleware/requestId';
import { approvalService } from '../services/approval.service';
import { createApprovalSchema, decideApprovalSchema } from '../validators/approval.validator';

export class ApprovalController {
  async getApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const approvals = await approvalService.getApprovals(req.user!, { status });
      res.json({
        success: true,
        data: approvals,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async getApprovalById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approval = await approvalService.getApprovalById(req.user!, req.params.id as string);
      res.json({
        success: true,
        data: approval,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async createApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createApprovalSchema.parse(req.body);
      const approval = await approvalService.createApproval(
        req.user!,
        validatedInput,
        req.ip || '127.0.0.1'
      );
      res.status(201).json({
        success: true,
        data: approval,
        message: 'Approval request submitted',
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }

  async decideApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = decideApprovalSchema.parse(req.body);
      const updated = await approvalService.decideApproval(
        req.user!,
        req.params.id as string,
        validatedInput,
        req.ip || '127.0.0.1'
      );
      res.json({
        success: true,
        data: updated,
        message: `Approval request ${validatedInput.decision}`,
        requestId: req.id,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const approvalController = new ApprovalController();
