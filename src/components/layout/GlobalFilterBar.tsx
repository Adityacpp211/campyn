import React, { useState, useEffect } from 'react';
import { Filter, ChevronRight } from 'lucide-react';
import { GlobalFilterState, Department } from '../../types';
import { api } from '../../services/api';

interface GlobalFilterBarProps {
  filter: GlobalFilterState;
  onFilterChange: (newFilter: Partial<GlobalFilterState>) => void;
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({ filter, onFilterChange }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([
      api.academics.departments(),
      api.academics.academicYears(),
      api.academics.semesters(),
      api.academics.sections(),
    ]).then(([deptRes, ayRes, semRes, secRes]) => {
      if (!isMounted) return;

      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) {
        setDepartments(deptRes.value);
        if (deptRes.value.length > 0 && (!filter.departmentId || filter.departmentId.startsWith('dept-'))) {
          // If using legacy ID or empty, set to real department ID
          onFilterChange({ departmentId: deptRes.value[0].id });
        }
      }

      if (ayRes.status === 'fulfilled' && Array.isArray(ayRes.value)) {
        setAcademicYears(ayRes.value);
        if (ayRes.value.length > 0 && !filter.academicYear) {
          onFilterChange({ academicYear: ayRes.value[0].name });
        }
      }

      if (semRes.status === 'fulfilled' && Array.isArray(semRes.value)) {
        setSemesters(semRes.value);
      }

      if (secRes.status === 'fulfilled' && Array.isArray(secRes.value)) {
        setSections(secRes.value);
      }
    });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-dark-charcoal)',
        borderBottom: '1px solid var(--color-border-gray)',
        padding: '8px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-light-gray)' }}>
          <Filter size={13} />
          <span style={{ fontWeight: 500 }}>Active Scope:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Academic Year (Populated from PostgreSQL) */}
          <select
            value={filter.academicYear}
            onChange={(e) => onFilterChange({ academicYear: e.target.value })}
            className="input-base"
            style={{ width: 'auto', padding: '3px 8px', fontSize: '12px' }}
          >
            {academicYears.length > 0 ? (
              academicYears.map((ay) => (
                <option key={ay.id} value={ay.name}>
                  AY {ay.name}
                </option>
              ))
            ) : (
              <option value="2026-2027">AY 2026-2027</option>
            )}
          </select>

          <ChevronRight size={12} color="var(--color-medium-gray)" />

          {/* Department (Populated with real Database IDs from PostgreSQL) */}
          <select
            value={filter.departmentId}
            onChange={(e) => onFilterChange({ departmentId: e.target.value })}
            className="input-base"
            style={{ width: 'auto', padding: '3px 8px', fontSize: '12px' }}
          >
            {departments.length > 0 ? (
              departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))
            ) : (
              <option value="dept-cse">Loading Departments...</option>
            )}
          </select>

          <ChevronRight size={12} color="var(--color-medium-gray)" />

          {/* Semester (Populated from PostgreSQL) */}
          <select
            value={filter.semester}
            onChange={(e) => onFilterChange({ semester: Number(e.target.value) })}
            className="input-base"
            style={{ width: 'auto', padding: '3px 8px', fontSize: '12px' }}
          >
            {semesters.length > 0 ? (
              semesters.map((s) => (
                <option key={s.id} value={s.semester_number || s.semesterNumber || 5}>
                  Semester {s.semester_number || s.semesterNumber} ({s.term || 'Active'})
                </option>
              ))
            ) : (
              <option value={5}>Semester 5 (Fall 2026)</option>
            )}
          </select>

          <ChevronRight size={12} color="var(--color-medium-gray)" />

          {/* Section (Populated from PostgreSQL) */}
          <select
            value={filter.section}
            onChange={(e) => onFilterChange({ section: e.target.value })}
            className="input-base"
            style={{ width: 'auto', padding: '3px 8px', fontSize: '12px' }}
          >
            {sections.length > 0 ? (
              sections.map((sec) => (
                <option key={sec.id} value={sec.name}>
                  {sec.name}
                </option>
              ))
            ) : (
              <option value="Section A">Section A</option>
            )}
          </select>
        </div>
      </div>

      <div style={{ color: 'var(--color-medium-gray)', fontSize: '11px' }}>
        Press <kbd style={{ padding: '2px 5px', background: 'var(--color-charcoal)', border: '1px solid var(--color-border-gray)', borderRadius: '3px', color: 'var(--color-light-gray)' }}>Ctrl + K</kbd> to search & jump
      </div>
    </div>
  );
};
