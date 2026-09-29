import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Loader2, CalendarPlus, AlertTriangle } from 'lucide-react';

interface ScheduleSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSlotCreated: () => void;
}

export const ScheduleSlotModal: React.FC<ScheduleSlotModalProps> = ({
  isOpen,
  onClose,
  onSlotCreated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const [courseOfferings, setCourseOfferings] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    sectionCourseId: '',
    dayOfWeek: 'Monday' as const,
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: 'Hall A-101',
    slotType: 'lecture' as const,
  });

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setConflictWarning(null);
      api.academics
        .courseOfferings()
        .then((offerings) => {
          setCourseOfferings(offerings || []);
          if (offerings && offerings.length > 0) {
            setFormData((prev) => ({ ...prev, sectionCourseId: offerings[0].id }));
          }
        })
        .catch((err) => {
          toast.error(err.message || 'Failed to load course offerings');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sectionCourseId || !formData.roomNumber.trim()) {
      toast.warning('Please select a course offering and specify a room number.');
      return;
    }

    try {
      setSubmitting(true);
      setConflictWarning(null);
      await api.timetable.createSlot({
        sectionCourseId: formData.sectionCourseId,
        dayOfWeek: formData.dayOfWeek,
        startTime: formData.startTime,
        endTime: formData.endTime,
        roomNumber: formData.roomNumber.trim(),
        slotType: formData.slotType,
      });

      toast.success(
        `Scheduled ${formData.slotType.toUpperCase()} on ${formData.dayOfWeek} (${formData.startTime} - ${formData.endTime}) in ${formData.roomNumber}`,
        'Timetable Slot Scheduled'
      );
      onSlotCreated();
      onClose();
    } catch (err: any) {
      if (err.message && (err.message.includes('conflict') || err.message.includes('Overlap'))) {
        setConflictWarning(err.message);
        toast.error(err.message, 'Scheduling Conflict');
      } else {
        toast.error(err.message || 'Failed to schedule timetable slot');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Timetable Slot">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px' }}>
          <Loader2 size={22} className="animate-spin" color="var(--color-white)" />
          <span style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>Loading course offerings...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {conflictWarning && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                color: '#fca5a5',
                fontSize: '12.5px',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Conflict Detected:</strong> {conflictWarning}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
              Course Offering & Section *
            </label>
            <select
              className="input-base"
              required
              value={formData.sectionCourseId}
              onChange={(e) => setFormData({ ...formData, sectionCourseId: e.target.value })}
            >
              {courseOfferings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.courseCode}: {o.courseTitle} ({o.sectionName}) — {o.facultyName || 'No Faculty'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Day of Week *
              </label>
              <select
                className="input-base"
                required
                value={formData.dayOfWeek}
                onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value as any })}
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Room / Venue *
              </label>
              <input
                type="text"
                required
                className="input-base"
                placeholder="e.g. Hall A-101, Lab 3"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Start Time (HH:MM) *
              </label>
              <input
                type="time"
                required
                className="input-base"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                End Time (HH:MM) *
              </label>
              <input
                type="time"
                required
                className="input-base"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Slot Type
              </label>
              <select
                className="input-base"
                value={formData.slotType}
                onChange={(e) => setFormData({ ...formData, slotType: e.target.value as any })}
              >
                <option value="lecture">Lecture</option>
                <option value="lab">Laboratory</option>
                <option value="tutorial">Tutorial</option>
                <option value="seminar">Seminar</option>
                <option value="break">Break</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-border-gray)',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || courseOfferings.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CalendarPlus size={15} />}
              Confirm Slot Allocation
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
