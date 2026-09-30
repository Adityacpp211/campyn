import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Loader2, PlusCircle } from 'lucide-react';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newExam: any) => void;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { toast } = useToast();
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [title, setTitle] = useState('');
  const [examType, setExamType] = useState<'internal' | 'midterm' | 'final' | 'lab'>('midterm');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.academics.semesters()
        .then((data) => {
          const list = Array.isArray(data) ? data : (data as any)?.data || [];
          setSemesters(list);
          if (list.length > 0) {
            setSelectedSemesterId(list[0].id);
          }
        })
        .catch((err) => {
          toast.error(err.message || 'Failed to load semesters');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSemesterId) {
      toast.warning('Please select an academic semester.');
      return;
    }
    if (!title.trim()) {
      toast.warning('Examination title is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.exams.create({
        semesterId: selectedSemesterId,
        title: title.trim(),
        examType,
      });

      toast.success(`Created examination '${title}' successfully`, 'Exam Scheduled');
      onCreated(res);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create examination');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Examination Session"
      subtitle="Establish official academic assessment session with grade locking protocol"
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px', color: 'var(--color-light-gray)' }}>
          <Loader2 className="animate-spin" size={18} />
          <span>Loading academic calendar...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Academic Semester *
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="input-base"
              style={{ width: '100%' }}
              required
            >
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  Semester {sem.semesterNumber || sem.semester_number} ({sem.startDate || sem.start_date || 'Current'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Examination Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Fall 2026 End-Semester Examinations"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
              Examination Category / Classification *
            </label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value as any)}
              className="input-base"
              style={{ width: '100%' }}
            >
              <option value="midterm">Midterm Examination</option>
              <option value="final">Final / End-Semester Examination</option>
              <option value="internal">Continuous Internal Assessment (CIA)</option>
              <option value="lab">Practical / Laboratory Examination</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Scheduling...
                </>
              ) : (
                <>
                  <PlusCircle size={14} /> Schedule Examination
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
