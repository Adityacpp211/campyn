import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Loader2, CheckCheck, UserCheck, XCircle, Clock } from 'lucide-react';

interface TakeAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (newSessionId: string) => void;
}

export const TakeAttendanceModal: React.FC<TakeAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSessionCreated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [courseOfferings, setCourseOfferings] = useState<any[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slotStart, setSlotStart] = useState<string>('09:00');
  const [slotEnd, setSlotEnd] = useState<string>('10:00');

  const [students, setStudents] = useState<any[]>([]);
  const [studentStatusMap, setStudentStatusMap] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});

  // 1. Fetch available course offerings / sections
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.academics
        .courseOfferings()
        .then((offerings) => {
          setCourseOfferings(offerings || []);
          if (offerings && offerings.length > 0) {
            setSelectedOfferingId(offerings[0].id);
          }
        })
        .catch((err) => {
          toast.error(err.message || 'Failed to load course offerings');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, toast]);

  // 2. Whenever selected offering changes, load enrolled students
  useEffect(() => {
    if (selectedOfferingId && isOpen) {
      const offering = courseOfferings.find((o) => o.id === selectedOfferingId);
      const sectionName = offering?.sectionName;

      api.students
        .list({ section: sectionName, limit: 100 })
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res.data || [];
          setStudents(list);
          // Default all students to present
          const initialMap: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
          list.forEach((s: any) => {
            initialMap[s.id] = 'present';
          });
          setStudentStatusMap(initialMap);
        })
        .catch(() => {
          setStudents([]);
        });
    }
  }, [selectedOfferingId, courseOfferings, isOpen]);

  const handleSetAll = (status: 'present' | 'absent') => {
    const updated = { ...studentStatusMap };
    students.forEach((s) => {
      updated[s.id] = status;
    });
    setStudentStatusMap(updated);
  };

  const handleToggleStatus = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setStudentStatusMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId) {
      toast.warning('Please select an active course offering/section.');
      return;
    }

    if (students.length === 0) {
      toast.warning('No students enrolled in this section to record attendance for.');
      return;
    }

    try {
      setSubmitting(true);
      const records = students.map((s) => ({
        studentId: s.id,
        status: studentStatusMap[s.id] || 'present',
      }));

      const res = await api.attendance.recordSession({
        sectionCourseId: selectedOfferingId,
        sessionDate,
        slotStart,
        slotEnd,
        records,
      });

      const newId = res?.data?.id || res?.id;
      toast.success(
        `Recorded attendance for ${records.length} students on ${sessionDate}`,
        'Attendance Session Captured'
      );
      onSessionCreated(newId);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to capture attendance session');
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = Object.values(studentStatusMap).filter((s) => s === 'present').length;
  const absentCount = Object.values(studentStatusMap).filter((s) => s === 'absent').length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Take Attendance — New Session">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px' }}>
          <Loader2 size={22} className="animate-spin" color="var(--color-white)" />
          <span style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>Loading course offerings...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Offering & Schedule */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Course Offering & Section *
              </label>
              <select
                className="input-base"
                required
                value={selectedOfferingId}
                onChange={(e) => setSelectedOfferingId(e.target.value)}
              >
                {courseOfferings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.courseCode} — {o.courseTitle} ({o.sectionName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Session Date *
              </label>
              <input
                type="date"
                required
                className="input-base"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Start Time
              </label>
              <input
                type="time"
                required
                className="input-base"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                End Time
              </label>
              <input
                type="time"
                required
                className="input-base"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Roster Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-dark-charcoal)',
              padding: '10px 14px',
              borderRadius: '6px',
              border: '1px solid var(--color-border-gray)',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{presentCount} Present</span>
              <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{absentCount} Absent</span>
              <span style={{ color: 'var(--color-light-gray)' }}>Total: {students.length} Students</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSetAll('present')}
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                Mark All Present
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleSetAll('absent')}
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                Mark All Absent
              </button>
            </div>
          </div>

          {/* Student Roster List */}
          <div
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              border: '1px solid var(--color-border-gray)',
              borderRadius: '6px',
            }}
          >
            {students.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-medium-gray)', fontSize: '13px' }}>
                No enrolled students found for the selected section.
              </div>
            ) : (
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Attendance State</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const st = studentStatusMap[s.id] || 'present';
                    return (
                      <tr key={s.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{s.rollNumber}</td>
                        <td style={{ fontWeight: 500, color: 'var(--color-white)' }}>
                          {s.firstName} {s.lastName}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s.id, 'present')}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid',
                                fontSize: '11px',
                                cursor: 'pointer',
                                backgroundColor: st === 'present' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                                borderColor: st === 'present' ? '#22c55e' : 'var(--color-border-gray)',
                                color: st === 'present' ? '#4ade80' : 'var(--color-light-gray)',
                              }}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s.id, 'absent')}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid',
                                fontSize: '11px',
                                cursor: 'pointer',
                                backgroundColor: st === 'absent' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                borderColor: st === 'absent' ? '#ef4444' : 'var(--color-border-gray)',
                                color: st === 'absent' ? '#f87171' : 'var(--color-light-gray)',
                              }}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s.id, 'late')}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid',
                                fontSize: '11px',
                                cursor: 'pointer',
                                backgroundColor: st === 'late' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                                borderColor: st === 'late' ? '#f59e0b' : 'var(--color-border-gray)',
                                color: st === 'late' ? '#fbbf24' : 'var(--color-light-gray)',
                              }}
                            >
                              Late
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Submit */}
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
              disabled={submitting || students.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
              Save Session & Submit Roster
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
