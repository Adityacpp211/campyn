import React, { useState } from 'react';
import { useAcademics } from '../../hooks/useAcademics';
import { GlobalFilterState } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Loader2 } from 'lucide-react';

interface CoursesViewProps {
  filter?: GlobalFilterState;
}

export const CoursesView: React.FC<CoursesViewProps> = ({ filter }) => {
  const [selectedDept, setSelectedDept] = useState<string>(filter?.departmentId || '');
  const activeDept = selectedDept || filter?.departmentId || undefined;
  const { courses, departments, loading, error, refetch } = useAcademics({
    departmentId: activeDept,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Departments & Course Catalog
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Curriculum, syllabus modules, and course-to-faculty allocations
          </p>
        </div>

        {departments.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-light-gray)' }}>Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-dark-charcoal)', color: 'var(--color-white)', border: '1px solid var(--color-border-gray)' }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
        )}
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
          <span>Loading academic course catalog...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="surface-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-light-gray)' }}>
          <p>No courses found in the catalog.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Credits</th>
                <th>Type</th>
                <th>Instructor</th>
                <th>Semester</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c: any) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                    {c.code}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--color-off-white)' }}>
                    {c.name}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>
                    {c.credits} Credits
                  </td>
                  <td>
                    <Badge variant={c.type === 'core' ? 'default' : 'info'}>
                      {(c.type || 'core').toUpperCase()}
                    </Badge>
                  </td>
                  <td style={{ color: 'var(--color-light-gray)' }}>
                    {c.facultyName || 'Department Faculty'}
                  </td>
                  <td>Semester {c.semester || c.semesterNumber || 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

