import React, { useState } from 'react';
import { useFees } from '../../hooks/useFees';
import { User, FeeDue, FeeTransaction } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { RotateCcw, Loader2, Download } from 'lucide-react';
import { hasPermission, PERMISSIONS } from '../../services/rbac';
import { exportToCsv } from '../../utils/exportCsv';
import { useToast } from '../../context/ToastContext';

interface FeesViewProps {
  currentUser: User;
}

export const FeesView: React.FC<FeesViewProps> = ({ currentUser }) => {
  const { toast } = useToast();
  const { dues, transactions, loading, error, collectPayment, processRefund } = useFees();
  const [selectedDue, setSelectedDue] = useState<FeeDue | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<'online' | 'bank_transfer' | 'cheque' | 'cash'>('online');
  const [refundTxn, setRefundTxn] = useState<FeeTransaction | null>(null);
  const [refundReason, setRefundReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const canCollect = hasPermission(currentUser.role, PERMISSIONS.FEES_COLLECT);
  const canRefund = hasPermission(currentUser.role, PERMISSIONS.FEES_REFUND);

  const handleOpenPay = (due: FeeDue) => {
    setSelectedDue(due);
    setPayAmount(due.outstandingAmount);
  };

  const handleCommitPay = async () => {
    if (!selectedDue || payAmount <= 0) return;
    try {
      setIsProcessing(true);
      await collectPayment(selectedDue.id, Number(payAmount), payMode);
      toast.success(
        `Successfully collected $${payAmount} for ${selectedDue.title} from ${selectedDue.studentName}`,
        'Payment Recorded'
      );
      setSelectedDue(null);
    } catch (err: any) {
      toast.error(err.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitRefund = async () => {
    if (!refundTxn || !refundReason.trim()) {
      toast.warning('Mandatory justification reason is required for transaction reversal.');
      return;
    }

    try {
      setIsProcessing(true);
      await processRefund(refundTxn.id, refundReason);
      toast.success(
        `Transaction ${refundTxn.receiptNumber || refundTxn.reference} refunded and credited to balance`,
        'Refund Completed'
      );
      setRefundTxn(null);
    } catch (err: any) {
      toast.error(err.message || 'Refund reversal failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportCsv = () => {
    if (!transactions || transactions.length === 0) {
      toast.warning('No fee transactions found to export.');
      return;
    }
    try {
      exportToCsv(
        `CAMPES_Fee_Ledger_${new Date().toISOString().split('T')[0]}`,
        transactions,
        [
          { header: 'Receipt No', accessor: (t) => t.receiptNumber || t.reference },
          { header: 'Student Name', accessor: (t) => t.studentName },
          { header: 'Amount ($)', accessor: (t) => t.amount },
          { header: 'Payment Mode', accessor: (t) => t.paymentMode.toUpperCase() },
          { header: 'Status', accessor: (t) => t.status.toUpperCase() },
          { header: 'Transaction Date', accessor: (t) => new Date(t.timestamp).toLocaleDateString() },
        ]
      );
      toast.success(`Exported ${transactions.length} fee transactions to CSV.`, 'Export Completed');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const totalCollected = transactions
    .filter((t) => t.status === 'success')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalOutstanding = dues.reduce((sum, d) => sum + Number(d.outstandingAmount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Fees & Financial Transaction Ledgers
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Strict double-entry PostgreSQL ledger with non-destructive audit reversals
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Download size={13} />
          Export Ledger CSV
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Financial Health Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="surface-card">
          <span className="text-secondary" style={{ fontSize: '11px' }}>TOTAL RECORDED COLLECTIONS</span>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#81C784', marginTop: '4px' }}>
            ${totalCollected.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)', marginTop: '2px' }}>
            From verified student settlements
          </div>
        </div>

        <div className="surface-card">
          <span className="text-secondary" style={{ fontSize: '11px' }}>OUTSTANDING RECEIVABLES</span>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#E57373', marginTop: '4px' }}>
            ${totalOutstanding.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)', marginTop: '2px' }}>
            Across active semester enrollments
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'var(--color-medium-gray)' }}>
          <Loader2 size={24} className="animate-spin" />
          <span style={{ marginLeft: '10px', fontSize: '13px' }}>Loading ledger accounts...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Student Dues Table */}
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-white)', marginBottom: '8px' }}>
              Student Dues Invoices
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student</th>
                    <th>Fee Particulars</th>
                    <th>Total Invoiced</th>
                    <th>Amount Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dues.map((due) => (
                    <tr key={due.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                        {due.studentRoll || (due as any).rollNumber}
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--color-off-white)' }}>
                        {due.studentName || `${(due as any).firstName || ''} ${(due as any).lastName || ''}`}
                      </td>
                      <td style={{ color: 'var(--color-light-gray)' }}>
                        {due.title || (due as any).feeStructureName}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        ${due.totalAmount}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#81C784' }}>
                        ${due.paidAmount}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: Number(due.outstandingAmount) > 0 ? '#E57373' : 'var(--color-light-gray)' }}>
                        ${due.outstandingAmount}
                      </td>
                      <td>
                        <Badge variant={due.status === 'paid' ? 'success' : due.status === 'partial' ? 'warning' : 'danger'}>
                          {due.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        {Number(due.outstandingAmount) > 0 && canCollect ? (
                          <button className="btn btn-primary btn-sm" onClick={() => handleOpenPay(due)}>
                            Record Payment
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>Cleared</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction History Ledger */}
          <div style={{ marginTop: '10px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-white)', marginBottom: '8px' }}>
              Immutable Financial Transaction Ledger
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference ID</th>
                    <th>Receipt #</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Payment Mode</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-light-gray)' }}>
                        {txn.reference || (txn as any).transactionReference}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                        {txn.receiptNumber}
                      </td>
                      <td>{txn.studentName}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: txn.status === 'success' ? '#81C784' : '#E57373' }}>
                        {txn.status === 'reversed' ? `-$${txn.amount}` : `$${txn.amount}`}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{txn.paymentMode.replace('_', ' ')}</td>
                      <td>
                        <Badge variant={txn.status === 'success' ? 'success' : 'danger'}>
                          {txn.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>
                        {new Date(txn.timestamp || (txn as any).createdAt).toLocaleString()}
                      </td>
                      <td>
                        {txn.status === 'success' && canRefund && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setRefundTxn(txn);
                              setRefundReason('');
                            }}
                          >
                            <RotateCcw size={11} /> Reversal
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Record Payment Modal */}
      {selectedDue && (
        <Modal
          isOpen={!!selectedDue}
          onClose={() => setSelectedDue(null)}
          title={`Collect Payment: ${selectedDue.studentName || ''}`}
          subtitle={`Invoiced: ${selectedDue.title || (selectedDue as any).feeStructureName} • Max Outstanding: $${selectedDue.outstandingAmount}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Payment Amount ($) *
              </label>
              <input
                type="number"
                min="1"
                max={selectedDue.outstandingAmount}
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="input-base"
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Payment Method
              </label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value as any)}
                className="input-base"
              >
                <option value="online">Online / Stripe Payment Gateway</option>
                <option value="bank_transfer">Wire Transfer / Direct Deposit</option>
                <option value="cheque">Demand Draft / Bank Cheque</option>
                <option value="cash">Counter Cash Receipt</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-outline" onClick={() => setSelectedDue(null)} disabled={isProcessing}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCommitPay} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Confirm & Issue Official Receipt'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Non-Destructive Refund Reversal Modal */}
      {refundTxn && (
        <Modal
          isOpen={!!refundTxn}
          onClose={() => setRefundTxn(null)}
          title={`Non-Destructive Reversal: ${refundTxn.receiptNumber}`}
          subtitle={`Amount to reverse: $${refundTxn.amount} for ${refundTxn.studentName}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: '#FFA4A4',
              }}
            >
              Per financial auditing rules, transactions are never deleted. A debit adjustment record will be generated in the ledger and the student's outstanding balance will be restored.
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Audit Justification / Reversal Rationale *
              </label>
              <textarea
                rows={3}
                placeholder="State the reason (e.g. Bank chargeback, payment entered in error, scholarship adjustment)..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="input-base"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-outline" onClick={() => setRefundTxn(null)} disabled={isProcessing}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleCommitRefund} disabled={isProcessing}>
                {isProcessing ? 'Reversing...' : 'Execute Adjustment Transaction'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
