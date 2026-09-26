import React, { useState } from 'react';
import { useTimetable } from '../../hooks/useTimetable';
import { GlobalFilterState } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { AlertTriangle, Clock, MapPin, User, Loader2 } from 'lucide-react';

interface TimetableViewProps {
  filter?: GlobalFilterState;
}

export const TimetableView: React.FC<TimetableViewProps> = ({ filter }) => {
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const days = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const { slots: allSlots, loading, error, conflictCount, refetch } = useTimetable();

  const slots = selectedDay === 'All'
    ? allSlots
    : allSlots.filter((s) => s.day === selectedDay || s.dayOfWeek === selectedDay);

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

