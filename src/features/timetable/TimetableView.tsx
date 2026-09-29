import React, { useState } from 'react';
import { useTimetable } from '../../hooks/useTimetable';
import { GlobalFilterState } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { AlertTriangle, Clock, MapPin, User, Loader2, Download, CalendarPlus, Trash2 } from 'lucide-react';
import { ScheduleSlotModal } from './ScheduleSlotModal';
import { exportToCsv } from '../../utils/exportCsv';
import { useToast } from '../../context/ToastContext';

interface TimetableViewProps {
  filter?: GlobalFilterState;
}

export const TimetableView: React.FC<TimetableViewProps> = ({ filter }) => {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const days = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const { slots: allSlots, loading, error, conflictCount, refetch, deleteSlot } = useTimetable();

  const slots = selectedDay === 'All'
    ? allSlots
    : allSlots.filter((s) => s.day === selectedDay || s.dayOfWeek === selectedDay);

  const handleExportCsv = () => {
    if (!slots || slots.length === 0) {
      toast.warning('No timetable slots available to export.');
      return;
    }
    try {
      exportToCsv(
        `CAMPES_Timetable_${selectedDay}_${new Date().toISOString().split('T')[0]}`,
        slots,
        [
          { header: 'Day', accessor: (s) => s.day || s.dayOfWeek || '' },
          { header: 'Time Slot', accessor: (s) => s.timeSlot },
          { header: 'Course Code', accessor: (s) => s.courseCode },
          { header: 'Course Name', accessor: (s) => s.courseName },
          { header: 'Faculty', accessor: (s) => s.facultyName || 'N/A' },
          { header: 'Room', accessor: (s) => s.roomNumber },
          { header: 'Section', accessor: (s) => s.sectionName },
          { header: 'Conflict Detected', accessor: (s) => (s.hasConflict ? 'YES' : 'NO') },
          { header: 'Conflict Note', accessor: (s) => s.conflictDetails || '' },
        ]
      );
      toast.success(`Exported ${slots.length} timetable slots to CSV.`, 'Export Completed');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const handleDeleteSlot = async (slotId: string, courseCode: string) => {
    const confirmDel = window.confirm(`Are you sure you want to remove timetable slot for ${courseCode}?`);
    if (!confirmDel) return;

    try {
      await deleteSlot(slotId);
      toast.success(`Removed timetable slot for ${courseCode}`, 'Slot Removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove timetable slot');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Class & Room Timetable
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Academic Term Schedule {filter?.section ? `• ${filter.section}` : ''} {filter?.academicYear ? `• AY ${filter.academicYear}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {conflictCount > 0 && (
            <div
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#FFA4A4',
              }}
            >
              <AlertTriangle size={15} />
              <span>{conflictCount} Scheduling Conflict Detected</span>
            </div>
          )}

          <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={13} />
            Export Schedule CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsScheduleOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CalendarPlus size={13} />
            Schedule Class Slot
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {/* Day Filter Pills */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`btn btn-sm ${selectedDay === day ? 'btn-primary' : 'btn-secondary'}`}
          >
            {day}
          </button>
        ))}
      </div>


      {/* Timetable Schedule Grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--color-light-gray)', gap: '8px' }}>
          <Loader2 className="animate-spin" size={20} />
          <span>Loading academic schedule...</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="surface-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-light-gray)' }}>
          <p>No timetable slots scheduled for this selection.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {slots.map((slot) => (
            <div
              key={slot.id}
              style={{
                padding: '14px',
                backgroundColor: 'var(--color-dark-charcoal)',
                border: slot.hasConflict ? '1px solid var(--color-danger-border)' : '1px solid var(--color-border-gray)',
                borderRadius: 'var(--radius-md)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {slot.hasConflict && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    backgroundColor: 'var(--color-danger)',
                  }}
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-light-gray)', textTransform: 'uppercase' }}>
                  {slot.day}
                </span>
                <Badge variant={slot.hasConflict ? 'danger' : 'default'}>
                  <Clock size={11} style={{ marginRight: '4px' }} /> {slot.timeSlot}
                </Badge>
              </div>

              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-white)' }}>
                {slot.courseCode}: {slot.courseName}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px', fontSize: '12px', color: 'var(--color-light-gray)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={13} color="var(--color-medium-gray)" /> {slot.facultyName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} color="var(--color-medium-gray)" /> {slot.roomNumber} ({slot.sectionName})
                </div>
              </div>

              {slot.hasConflict && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 10px',
                    backgroundColor: 'var(--color-danger-bg)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    color: '#FFBABA',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>{slot.conflictDetails}</span>
                </div>
              )}

              {/* Slot Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '12px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDeleteSlot(slot.id, slot.courseCode)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: slot.hasConflict ? '#f87171' : 'var(--color-light-gray)',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ef4444';
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = slot.hasConflict ? '#f87171' : 'var(--color-light-gray)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Remove timetable slot"
                >
                  <Trash2 size={12} />
                  <span>{slot.hasConflict ? 'Resolve Clash (Delete)' : 'Remove Slot'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Class Slot Modal */}
      <ScheduleSlotModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onSlotCreated={() => refetch()}
      />
    </div>
  );
};

