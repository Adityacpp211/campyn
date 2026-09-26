import React from 'react';
import { useFaculty } from '../../hooks/useFaculty';
import { GlobalFilterState } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Mail, Award, BookOpen, Loader2 } from 'lucide-react';

interface FacultyViewProps {
  filter?: GlobalFilterState;
}

export const FacultyView: React.FC<FacultyViewProps> = ({ filter }) => {
  const { faculty, loading, error, refetch } = useFaculty({
    departmentId: filter?.departmentId || undefined,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Faculty & Academic Staff Roster
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Instructional faculty, course assignments, and research specializations
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--color-light-gray)', gap: '8px' }}>
          <Loader2 className="animate-spin" size={20} />
          <span>Loading academic faculty roster...</span>
        </div>
      ) : faculty.length === 0 ? (
        <div className="surface-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-light-gray)' }}>
          <p>No faculty records found in this institution.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {faculty.map((f) => (
            <div key={f.id} className="surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Badge variant="info">{f.employeeId}</Badge>
                <Badge variant={f.designation?.includes('HOD') ? 'success' : 'default'}>
                  {f.designation}
                </Badge>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-white)', marginTop: '10px' }}>
                {f.firstName} {f.lastName}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-light-gray)', marginTop: '2px' }}>
                {f.qualification || 'Doctor of Philosophy'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--color-light-gray)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={13} color="var(--color-medium-gray)" /> {f.specialization || 'Academic Instruction'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13} color="var(--color-medium-gray)" /> {f.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={13} color="var(--color-medium-gray)" /> Courses: {Array.isArray(f.coursesHandled) && f.coursesHandled.length > 0 ? f.coursesHandled.join(', ') : 'None assigned'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

