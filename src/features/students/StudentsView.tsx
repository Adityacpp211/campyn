import React, { useState } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { Student, GlobalFilterState } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface StudentsViewProps {
  selectedStudentId?: string;
  filter?: GlobalFilterState;
}

export const StudentsView: React.FC<StudentsViewProps> = ({ selectedStudentId, filter }) => {
  const [search, setSearch] = useState('');
  const { students, pagination, loading, error } = useStudents({
    search,
    departmentId: filter?.departmentId || undefined,
    section: filter?.section || undefined,
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'marks' | 'fees' | 'timeline'>('overview');

  // Select initial student if prop passed or first loaded
  React.useEffect(() => {
    if (selectedStudentId && students.length > 0) {
      const match = students.find((s) => s.id === selectedStudentId);
      if (match) setSelectedStudent(match);
    }
  }, [selectedStudentId, students]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Students Academic Directory
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Total {pagination.total} enrolled students in institutional scope
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} color="var(--color-medium-gray)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search by name, roll no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base"
              style={{ paddingLeft: '32px' }}
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => alert('Student Export CSV generated.')}>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Students Data Table */}
      <div className="table-container" style={{ position: 'relative' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'var(--color-medium-gray)' }}>
            <Loader2 size={24} className="animate-spin" />
            <span style={{ marginLeft: '10px', fontSize: '13px' }}>Loading student records...</span>
          </div>
        )}

        {!loading && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Student Name</th>
                <th>Program & Section</th>
                <th>Attendance</th>
                <th>CGPA</th>
                <th>Fee Status</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-medium-gray)' }}>
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} onClick={() => setSelectedStudent(s)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                      {s.rollNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--color-off-white)' }}>
                        {s.firstName} {s.lastName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>
                        {s.email}
                      </div>
                    </td>
                    <td>
                      {s.programName}
                      <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>
                        {s.sectionName} • Sem {s.semesterNumber}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: (s.attendancePercentage || 0) >= 75 ? '#81C784' : '#E57373',
                        }}
                      >
                        {s.attendancePercentage || 0}%
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                      {s.cgpa || 3.75}
                    </td>
                    <td>
                      <Badge variant={(s.pendingFees || 0) === 0 ? 'success' : (s.pendingFees || 0) < 3000 ? 'warning' : 'danger'}>
                        {(s.pendingFees || 0) === 0 ? 'Settled' : `$${s.pendingFees} Due`}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={s.academicStatus === 'active' ? 'default' : 'warning'}>
                        {s.academicStatus}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudent(s);
                        }}
                      >
                        View Dossier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Server Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--color-border-gray)', fontSize: '12px', color: 'var(--color-light-gray)' }}>
          <span>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              style={{ opacity: pagination.page <= 1 ? 0.5 : 1 }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              style={{ opacity: pagination.page >= pagination.totalPages ? 0.5 : 1 }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Academic Identity Modal Dossier */}
      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title={`Academic Dossier: ${selectedStudent.firstName} ${selectedStudent.lastName}`}
          subtitle={`Roll: ${selectedStudent.rollNumber} • ID: ${selectedStudent.studentIdNumber}`}
          maxWidth="680px"
        >
          {/* Sub-tabs inside Dossier */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              borderBottom: '1px solid var(--color-border-gray)',
              marginBottom: '16px',
            }}
          >
            {(['overview', 'attendance', 'marks', 'fees', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--color-white)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--color-white)' : 'var(--color-light-gray)',
                  fontSize: '12px',
                  fontWeight: activeTab === tab ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
              <div className="surface-card">
                <span className="text-secondary" style={{ fontSize: '11px' }}>REGISTRATION NUMBER</span>
                <div style={{ fontWeight: 600, color: 'var(--color-white)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                  {selectedStudent.registrationNumber}
                </div>
              </div>

              <div className="surface-card">
                <span className="text-secondary" style={{ fontSize: '11px' }}>DATE OF BIRTH & BLOOD</span>
                <div style={{ fontWeight: 600, color: 'var(--color-white)', marginTop: '2px' }}>
                  {selectedStudent.dateOfBirth} • Blood: {selectedStudent.bloodGroup}
                </div>
              </div>

              <div className="surface-card">
                <span className="text-secondary" style={{ fontSize: '11px' }}>CONTACT</span>
                <div style={{ fontWeight: 500, color: 'var(--color-off-white)', marginTop: '2px' }}>
                  {selectedStudent.phone}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>
                  {selectedStudent.email}
                </div>
              </div>

              <div className="surface-card">
                <span className="text-secondary" style={{ fontSize: '11px' }}>GUARDIAN DETAILS</span>
                <div style={{ fontWeight: 500, color: 'var(--color-off-white)', marginTop: '2px' }}>
                  {selectedStudent.guardianName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>
                  {selectedStudent.guardianPhone}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Attendance */}
          {activeTab === 'attendance' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
                  Overall Term Attendance: <strong style={{ color: 'var(--color-white)' }}>{selectedStudent.attendancePercentage || 85}%</strong>
                </span>
                <Badge variant={(selectedStudent.attendancePercentage || 85) >= 75 ? 'success' : 'danger'}>
                  {(selectedStudent.attendancePercentage || 85) >= 75 ? 'Eligible for Finals' : 'Attendance Shortage Alert'}
                </Badge>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Total Sessions</th>
                      <th>Attended</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>CS301 Data Structures</td>
                      <td>24</td>
                      <td>22</td>
                      <td style={{ color: '#81C784', fontWeight: 600 }}>91.6%</td>
                    </tr>
                    <tr>
                      <td>CS302 Operating Systems</td>
                      <td>22</td>
                      <td>18</td>
                      <td style={{ color: '#81C784', fontWeight: 600 }}>81.8%</td>
                    </tr>
                    <tr>
                      <td>CS304 Computer Networks</td>
                      <td>20</td>
                      <td>14</td>
                      <td style={{ color: '#FFB74D', fontWeight: 600 }}>70.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Marks */}
          {activeTab === 'marks' && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Course</th>
                    <th>Marks Obtained</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Midterm Exam 2026</td>
                    <td>CS301 Data Structures</td>
                    <td>44 / 50</td>
                    <td><Badge variant="success">A+</Badge></td>
                  </tr>
                  <tr>
                    <td>Midterm Exam 2026</td>
                    <td>CS302 Operating Systems</td>
                    <td>38 / 50</td>
                    <td><Badge variant="success">A</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Fees */}
          {activeTab === 'fees' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>Semester Academic Dues: $5,200</span>
                <Badge variant={(selectedStudent.pendingFees || 0) === 0 ? 'success' : 'danger'}>
                  {(selectedStudent.pendingFees || 0) === 0 ? 'Fully Paid' : `$${selectedStudent.pendingFees} Outstanding`}
                </Badge>
              </div>
            </div>
          )}

          {/* Tab 5: Timeline */}
          {activeTab === 'timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-white)', marginTop: '5px' }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-white)' }}>Enrolled in Program</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>Aug 01, 2024 • Academic Registry</div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
