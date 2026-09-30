import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Assignment } from '../../types';
import { Loader2, UploadCloud, AlertCircle } from 'lucide-react';

interface SubmitAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  onSubmitted: () => void;
}

export const SubmitAssignmentModal: React.FC<SubmitAssignmentModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSubmitted,
}) => {
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!assignment) return null;

  const isPastDue = new Date() > new Date(assignment.dueDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl.trim() && !notes.trim()) {
      toast.warning('Please provide a repository URL, document link, or solution summary.');
      return;
    }

    try {
      setSubmitting(true);
      await api.assignments.submit(assignment.id, {
        fileUrl: fileUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      toast.success(
        `Your deliverable for '${assignment.title}' was recorded successfully.`,
        'Deliverable Submitted'
      );
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Assignment: ${assignment.courseCode}`}
      subtitle={assignment.title}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {isPastDue && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: assignment.allowLate ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
              border: `1px solid ${assignment.allowLate ? 'var(--color-warning-border)' : 'var(--color-danger-border)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: assignment.allowLate ? '#FFB74D' : '#FF8A80',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>
              {assignment.allowLate
                ? 'The deadline has passed. This deliverable will be flagged as a LATE submission.'
                : 'The deadline for this assignment has expired. Submissions are no longer accepted.'}
            </span>
          </div>
        )}

        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
            Solution Repository URL / Artifact Link
          </label>
          <input
            type="url"
            placeholder="https://github.com/org/repo or https://drive.campus.edu/..."
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            className="input-base"
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
            Submission Notes & Verification Invariants
          </label>
          <textarea
            rows={4}
            placeholder="Describe approach, benchmark performance, reproduction instructions, test coverage..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-base"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || (isPastDue && !assignment.allowLate)}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Submitting...
              </>
            ) : (
              <>
                <UploadCloud size={14} /> Turn In Deliverable
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
