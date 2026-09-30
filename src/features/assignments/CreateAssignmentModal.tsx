import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Loader2, PlusCircle } from 'lucide-react';

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newAsg: any) => void;
}

export const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { toast } = useToast();
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSectionCourseId, setSelectedSectionCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxMarks, setMaxMarks] = useState<number>(50);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [allowLate, setAllowLate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.academics.courseOfferings()
        .then((data) => {
          const list = Array.isArray(data) ? data : (data as any)?.data || [];
          setOfferings(list);
          if (list.length > 0) {
            setSelectedSectionCourseId(list[0].id);
          }
        })
        .catch((err) => {
          toast.error(err.message || 'Failed to load course section offerings');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSectionCourseId) {
      toast.warning('Please select a course offering.');
      return;
    }
    if (!title.trim()) {
      toast.warning('Assignment title is mandatory.');
      return;
    }
    if (maxMarks <= 0) {
      toast.warning('Maximum marks must be greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.assignments.create({
        sectionCourseId: selectedSectionCourseId,
        title: title.trim(),
        description: description.trim(),
        maxMarks: Number(maxMarks),
        dueDate: new Date(`${dueDate}T23:59:59Z`).toISOString(),
        allowLate,
      });

      toast.success(`Created coursework '${title}' successfully`, 'Assignment Published');
      onCreated(res);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Coursework Assignment"
      subtitle="Publish an evaluatable deliverable with cryptographic audit trail"
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px', color: 'var(--color-light-gray)' }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Loading course section allocations...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Assigned Course & Section *
            </label>
            <select
              value={selectedSectionCourseId}
              onChange={(e) => setSelectedSectionCourseId(e.target.value)}
              className="input-base"
              style={{ width: '100%' }}
              required
            >
              {offerings.map((off) => (
                <option key={off.id} value={off.id}>
                  {off.courseCode} - {off.courseName} ({off.sectionName}) • {off.facultyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Assignment Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Lab 4: Distributed Consensus Protocols"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Instructions & Deliverable Description
            </label>
            <textarea
              rows={3}
              placeholder="Detail assignment expectations, benchmark criteria, or submission guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-base"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Maximum Marks *
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="input-base"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Due Date *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-base"
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              type="checkbox"
              id="allowLateCheck"
              checked={allowLate}
              onChange={(e) => setAllowLate(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="allowLateCheck" style={{ fontSize: '12px', color: 'var(--color-light-gray)', cursor: 'pointer' }}>
              Allow submissions after deadline (will be marked as Late)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Publishing...
                </>
              ) : (
                <>
                  <PlusCircle size={14} /> Create Assignment
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
