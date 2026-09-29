import React, { useState } from 'react';
import { User, ApprovalRequest } from '../../types';
import { useApprovals } from '../../hooks/useApprovals';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface ApprovalsViewProps {
  currentUser: User;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({ currentUser: _currentUser }) => {
  const { toast } = useToast();
  const { requests, pendingCount, loading, error, resolveApproval, refetch } = useApprovals();
  const [activeRequest, setActiveRequest] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenDecision = (req: ApprovalRequest, type: 'approved' | 'rejected') => {
    setActiveRequest(req);
    setDecision(type);
    setDecisionReason('');
  };

  const handleCommitDecision = async () => {
    if (!activeRequest || !decisionReason.trim()) {
      toast.warning('Mandatory justification reason required to resolve workflow.');
      return;
    }

    try {
      setIsSubmitting(true);
      await resolveApproval(activeRequest.id, decision, decisionReason);
      toast.success(
        `Approval request #${activeRequest.id.substring(0, 8)} marked as ${decision.toUpperCase()}`,
        'Workflow Resolved'
      );
      setActiveRequest(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve approval request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Two-Tier Approval Workflows
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Centralized queue for grade revisions, attendance waivers, and fee adjustments
          </p>
        </div>

        <Badge variant={pendingCount > 0 ? 'warning' : 'success'}>
          {pendingCount} Pending Resolution
        </Badge>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Requests Table */}
      <div className="table-container">
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'var(--color-medium-gray)' }}>
            <Loader2 size={24} className="animate-spin" />
            <span style={{ marginLeft: '10px', fontSize: '13px' }}>Loading governance requests...</span>
          </div>
        )}

        {!loading && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Request Type</th>
                <th>Requester</th>
                <th>Entity</th>
                <th>Justification Rationale</th>
                <th>Assigned Approver</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-medium-gray)' }}>
                    No approval requests found in this queue.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-white)' }}>
                      {req.requestType}
                    </td>
                    <td>
                      <div>{req.requesterName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>
                        Role: {req.requesterRole}
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      <Badge variant="default">{req.entity}</Badge>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-light-gray)', maxWidth: '280px' }}>
                      "{req.reason}"
                      {req.decisionReason && (
                        <div style={{ marginTop: '4px', color: '#81C784', fontSize: '11px' }}>
                          Resolution: {req.decisionReason}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-light-gray)' }}>
                      {req.currentApprover || 'Unassigned'}
                    </td>
                    <td>
                      <Badge
                        variant={
                          req.status === 'approved'
                            ? 'success'
                            : req.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {req.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      {req.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenDecision(req, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleOpenDecision(req, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>Finalized</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Decision Resolution Modal */}
      {activeRequest && (
        <Modal
          isOpen={!!activeRequest}
          onClose={() => setActiveRequest(null)}
          title={`${decision === 'approved' ? 'Approve' : 'Reject'} Workflow: ${activeRequest.requestType}`}
          subtitle={`Requester: ${activeRequest.requesterName} (${activeRequest.requesterRole})`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-charcoal)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-light-gray)' }}>Requested Justification:</span>
              <div style={{ color: 'var(--color-white)', marginTop: '4px', fontWeight: 500 }}>
                "{activeRequest.reason}"
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Approver's Official Rationale *
              </label>
              <textarea
                rows={3}
                placeholder="State the regulatory basis or verification details for this sign-off..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                className="input-base"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-outline" onClick={() => setActiveRequest(null)} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className={`btn ${decision === 'approved' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleCommitDecision}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing...' : `Confirm ${decision === 'approved' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
