import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { enforceTenantIsolation } from '../middleware/tenantIsolation';
import { feeController } from '../controllers/fee.controller';
import { withTransaction } from '../db';
import { createAuditLog } from '../services/auditService';

export const feesRouter = Router();

feesRouter.use(authenticateToken);
feesRouter.use(enforceTenantIsolation);

// GET /api/v1/fees/dues
feesRouter.get(
  '/dues',
  requirePermission('fees.read'),
  feeController.getDues.bind(feeController)
);

// GET /api/v1/fees/transactions
feesRouter.get(
  '/transactions',
  requirePermission('fees.read'),
  feeController.getTransactions.bind(feeController)
);

// POST /api/v1/fees/collect (Atomic transactional fee settlement)
feesRouter.post(
  '/collect',
  requirePermission('fees.collect'),
  async (req: Request, res: Response): Promise<void> => {
    const feeDueId = req.body.feeDueId || req.body.studentFeeDueId;
    const amount = Number(req.body.amount);
    const paymentMode = req.body.paymentMode || 'online';

    if (!feeDueId || !amount || amount <= 0) {
      res.status(400).json({ success: false, error: { message: 'Valid feeDueId and amount > 0 are required' } });
      return;
    }

    try {
      const outcome = await withTransaction(async (tx) => {
        // 1. Lock and fetch current fee due
        const dueRes = await tx.query(`
          SELECT 
            sfd.id, sfd.student_id, sfd.total_amount, sfd.paid_amount, sfd.outstanding_amount, sfd.status,
            CONCAT(u.first_name, ' ', u.last_name) as student_name
          FROM student_fee_dues sfd
          JOIN students s ON sfd.student_id = s.id
          JOIN users u ON s.user_id = u.id
          WHERE sfd.id = $1
        `, [feeDueId]);

        if (dueRes.rows.length === 0) {
          throw new Error('Fee due record not found');
        }

        const due = dueRes.rows[0];
        const curOutstanding = parseFloat(due.outstanding_amount);
        if (curOutstanding <= 0) {
          throw new Error('Fee due is already fully paid');
        }

        const actualPayment = Math.min(amount, curOutstanding);
        const newPaid = parseFloat(due.paid_amount) + actualPayment;
        const newOutstanding = curOutstanding - actualPayment;
        const newStatus = newOutstanding === 0 ? 'paid' : 'partial';

        // 2. Update due record
        await tx.query(`
          UPDATE student_fee_dues
          SET paid_amount = $1, outstanding_amount = $2, status = $3
          WHERE id = $4
        `, [newPaid, newOutstanding, newStatus, feeDueId]);

        // 3. Create transaction record
        const ref = `TXN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const receipt = `REC-${Math.floor(10000 + Math.random() * 90000)}`;

        const txnRes = await tx.query(`
          INSERT INTO fee_transactions (
            student_fee_due_id, transaction_reference, amount, payment_mode, status, processed_by, receipt_number, notes
          ) VALUES (
            $1, $2, $3, $4, 'success', $5, $6, $7
          ) RETURNING *
        `, [feeDueId, ref, actualPayment, paymentMode, req.user!.id, receipt, `Collected by ${req.user!.firstName} ${req.user!.lastName} (${req.user!.role})`]);

        const txn = txnRes.rows[0];

        // 4. Cryptographic audit log
        await createAuditLog({
          actorId: req.user!.id,
          actorEmail: req.user!.email,
          role: req.user!.role,
          action: 'PAYMENT',
          entity: 'student_fee_dues',
          entityId: feeDueId,
          institutionId: req.user!.institutionId,
          oldValues: { paid: due.paid_amount, outstanding: due.outstanding_amount, status: due.status },
          newValues: { paid: newPaid, outstanding: newOutstanding, status: newStatus, txnId: txn.id, reference: ref },
          reason: `Payment collected for ${due.student_name}: $${actualPayment} via ${paymentMode}. Receipt: ${receipt}`,
          ipAddress: req.ip || '127.0.0.1',
        }, tx);

        return {
          transaction: txn,
          updatedDue: {
            id: feeDueId,
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status: newStatus,
          },
        };
      });

      res.status(200).json({
        success: true,
        message: 'Payment recorded and settled atomically in PostgreSQL ledger',
        data: outcome,
        requestId: req.id,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message }, requestId: req.id });
    }
  }
);

// POST /api/v1/fees/pay
feesRouter.post(
  '/pay',
  requirePermission('fees.collect'),
  feeController.processPayment.bind(feeController)
);

// POST /api/v1/fees/transactions/:id/refund
feesRouter.post(
  '/transactions/:id/refund',
  requirePermission('fees.refund'),
  async (req: Request, res: Response): Promise<void> => {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const { reason } = req.body;

    if (!id) {
      res.status(400).json({ success: false, error: { message: 'Valid transaction id is required' } });
      return;
    }

    if (!reason || reason.trim().length < 5) {
      res.status(400).json({ success: false, error: { message: 'A mandatory justification reason (min 5 characters) is required for refund reversal' } });
      return;
    }

    try {
      const outcome = await withTransaction(async (tx) => {
        const txnRes = await tx.query(`
          SELECT ft.*, sfd.student_id, sfd.total_amount, sfd.paid_amount, sfd.outstanding_amount
          FROM fee_transactions ft
          JOIN student_fee_dues sfd ON ft.student_fee_due_id = sfd.id
          WHERE ft.id = $1
        `, [id]);

        if (txnRes.rows.length === 0) {
          throw new Error('Transaction record not found');
        }

        const txn = txnRes.rows[0];
        if (txn.status === 'reversed') {
          throw new Error('Transaction is already reversed');
        }

        const refundAmount = parseFloat(txn.amount);
        const newPaid = Math.max(0, parseFloat(txn.paid_amount) - refundAmount);
        const newOutstanding = parseFloat(txn.outstanding_amount) + refundAmount;
        const newStatus = newOutstanding >= parseFloat(txn.total_amount) ? 'unpaid' : 'partial';

        await tx.query(`
          UPDATE fee_transactions
          SET status = 'reversed', notes = CONCAT(COALESCE(notes, ''), ' | Reversed: ', $1)
          WHERE id = $2
        `, [reason, id]);

        await tx.query(`
          UPDATE student_fee_dues
          SET paid_amount = $1, outstanding_amount = $2, status = $3
          WHERE id = $4
        `, [newPaid, newOutstanding, newStatus, txn.student_fee_due_id]);

        await createAuditLog({
          actorId: req.user!.id,
          actorEmail: req.user!.email,
          role: req.user!.role,
          action: 'REFUND',
          entity: 'fee_transactions',
          entityId: id,
          institutionId: req.user!.institutionId,
          oldValues: { amount: refundAmount, status: txn.status },
          newValues: { reversedAmount: refundAmount, status: 'reversed', feeDueId: txn.student_fee_due_id },
          reason: `Transaction ${txn.transaction_reference} reversed. Reason: ${reason}`,
          ipAddress: req.ip || '127.0.0.1',
        }, tx);

        return {
          transactionId: id,
          reversedAmount: refundAmount,
          updatedDueId: txn.student_fee_due_id,
          newOutstanding,
        };
      });

      res.status(200).json({
        success: true,
        message: 'Transaction reversed and outstanding balance restored in PostgreSQL ledger',
        data: outcome,
        requestId: req.id,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: { message: err.message }, requestId: req.id });
    }
  }
);
