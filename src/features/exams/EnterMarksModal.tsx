import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { MarksEntry } from '../../types';
import { Loader2, Award } from 'lucide-react';

interface EnterMarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: MarksEntry | null;
  onSaved: (id: string, marksObtained: number, grade: string, reason: string) => Promise<any>;
}

export const EnterMarksModal: React.FC<EnterMarksModalProps> = ({
  isOpen,
  onClose,
  entry,
  onSaved,
}) => {
  const { toast } = useToast();
  const [marks, setMarks] = useState<number>(entry?.marksObtained || 0);
  const [grade, setGrade] = useState<string>(entry?.grade || 'A');
  const [reason, setReason] = useState<string>('Evaluation completed in accordance with course rubric');
  const [submitting, setSubmitting] = useState(false);

  // Sync state when entry changes
  React.useEffect(() => {
    if (entry) {
      setMarks(entry.marksObtained);
      setGrade(entry.grade || computeGrade(entry.marksObtained, entry.maxMarks));
      setReason('Evaluation completed in accordance with course rubric');
    }
  }, [entry]);

  if (!entry) return null;

  function computeGrade(obtained: number, max: number): string {
    const pct = (obtained / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }

  const handleMarksChange = (val: number) => {
    setMarks(val);
    setGrade(computeGrade(val, entry.maxMarks));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (marks < 0 || marks > entry.maxMarks) {
      toast.warning(`Marks must be between 0 and ${entry.maxMarks}.`);
      return;
    }
    if (!reason.trim()) {
      toast.warning('Mandatory audit justification reason is required for grade revision.');
      return;
    }

    try {
      setSubmitting(true);
      await onSaved(entry.id, Number(marks), grade, reason.trim());
      toast.success(
        `Marks for ${entry.studentName} updated to ${marks}/${entry.maxMarks} (${grade})`,
        'Grade Recorded'
      );
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update marks entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Enter Evaluation Marks: ${entry.studentName}`}
      subtitle={`Roll: ${entry.studentRoll} • Course: ${entry.courseCode}`}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Marks Obtained (Max: {entry.maxMarks}) *
            </label>
            <input
              type="number"
              min="0"
              max={entry.maxMarks}
              step="0.5"
              value={marks}
              onChange={(e) => handleMarksChange(Number(e.target.value))}
              className="input-base"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Letter Grade *
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="input-base"
              style={{ width: '100%' }}
            >
              <option value="A+">A+ (Outstanding / 90%+)</option>
              <option value="A">A (Excellent / 80%+)</option>
              <option value="B+">B+ (Very Good / 70%+)</option>
              <option value="B">B (Good / 60%+)</option>
              <option value="C">C (Satisfactory / 50%+)</option>
              <option value="D">D (Marginal / 40%+)</option>
              <option value="F">F (Fail / &lt;40%)</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
            Mandatory Cryptographic Audit Justification *
          </label>
          <input
            type="text"
            placeholder="e.g. Verified answer booklet evaluation; moderated moderation score"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-base"
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Recording...
              </>
            ) : (
              <>
                <Award size={14} /> Commit Grade to Ledger
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
