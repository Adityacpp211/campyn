import React, { useState, useEffect } from 'react';
import { Assignment, Submission, User } from '../../types';
import { useAssignments } from '../../hooks/useAssignments';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Loader2, RefreshCw } from 'lucide-react';

interface AssignmentsViewProps {
  currentUser: User;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({ currentUser: _currentUser }) => {
  const { assignments, loading, error, fetchSubmissions, refetch } = useAssignments();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeMarks, setGradeMarks] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');

  useEffect(() => {
    if (assignments.length > 0 && !selectedAssignment) {
      setSelectedAssignment(assignments[0]);
    }
  }, [assignments, selectedAssignment]);

  useEffect(() => {
    if (selectedAssignment) {
      setSubsLoading(true);
      fetchSubmissions(selectedAssignment.id)
        .then((subs) => setSubmissions(subs))
        .finally(() => setSubsLoading(false));
    } else {
      setSubmissions([]);
    }
  }, [selectedAssignment, fetchSubmissions]);

  const handleOpenGrade = (sub: Submission) => {
    setGradingSubmission(sub);
    setGradeMarks(sub.marksAwarded || 0);
    setGradeFeedback(sub.feedback || '');
  };

  const handleCommitGrade = () => {
    if (!gradingSubmission || !selectedAssignment) return;

    // Update submissions list immutably
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === gradingSubmission.id
          ? { ...s, marksAwarded: Number(gradeMarks), feedback: gradeFeedback, status: 'graded' as const }
          : s
      )
    );
    setGradingSubmission(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Coursework & Assignments
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Course deliverables, programming benchmarks, and academic evaluations
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--color-light-gray)', gap: '8px' }}>
          <Loader2 className="animate-spin" size={20} />
          <span>Loading assignments from course catalog...</span>
        </div>
      ) : assignments.length === 0 ? (
        <div className="surface-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-light-gray)' }}>
          <p>No active coursework assignments configured for this term.</p>
        </div>
      ) : (
        <>
          {/* Assignment Cards List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {assignments.map((asg) => {
              const isSelected = selectedAssignment?.id === asg.id;
              return (
                <div
                  key={asg.id}
                  onClick={() => setSelectedAssignment(asg)}
                  className="surface-card"
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--color-white)' : 'var(--color-border-gray)',
                    backgroundColor: isSelected ? 'var(--color-charcoal)' : 'var(--color-dark-charcoal)',
                    transition: 'all 120ms ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Badge variant="default">{asg.courseCode}</Badge>
                    <div style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>
                      Max Marks: <strong style={{ color: 'var(--color-white)' }}>{asg.maxMarks}</strong>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-white)', marginTop: '8px' }}>
                    {asg.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-light-gray)', marginTop: '4px' }}>
                    {asg.description}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '14px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--color-border-gray)',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ color: '#FFB74D' }}>Due: {String(asg.dueDate).split('T')[0]}</span>
                    <span style={{ color: 'var(--color-light-gray)' }}>
                      {asg.submissionCount || 0} of {asg.totalStudents || 0} Submitted
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submissions Roster */}
          {selectedAssignment && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-white)' }}>
                  Submissions for {selectedAssignment.courseCode} ({submissions.length})
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--color-medium-gray)' }}>
                  Click Grade to evaluate student submission
                </span>
              </div>

              {subsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--color-light-gray)', gap: '8px' }}>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Loading submissions...</span>
                </div>
              ) : submissions.length === 0 ? (
                <div className="surface-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-medium-gray)', fontSize: '13px' }}>
                  No student submissions recorded for this assignment yet.
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th>Submitted Timestamp</th>
                        <th>Status</th>
                        <th>Marks (Max {selectedAssignment.maxMarks})</th>
                        <th>Feedback</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => (
                        <tr key={sub.id || sub.studentRoll}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                            {sub.studentRoll}
                          </td>
                          <td style={{ fontWeight: 500, color: 'var(--color-off-white)' }}>
                            {sub.studentName}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--color-light-gray)' }}>
                            {sub.submittedAt || 'Pending'}
                            {sub.isLate && <Badge variant="danger" style={{ marginLeft: '6px' }}>Late</Badge>}
                          </td>
                          <td>
                            <Badge variant={sub.status === 'graded' ? 'success' : 'warning'}>
                              {(sub.status || 'pending').toUpperCase()}
                            </Badge>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                            {sub.marksAwarded !== undefined ? `${sub.marksAwarded} / ${selectedAssignment.maxMarks}` : '—'}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--color-light-gray)', maxWidth: '240px' }}>
                            {sub.feedback || 'No feedback recorded.'}
                          </td>
                          <td>
                            <button className="btn btn-outline btn-sm" onClick={() => handleOpenGrade(sub)}>
                              {sub.status === 'graded' ? 'Edit Grade' : 'Grade'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Evaluation Modal */}
      {gradingSubmission && selectedAssignment && (
        <Modal
          isOpen={!!gradingSubmission}
          onClose={() => setGradingSubmission(null)}
          title={`Evaluate Submission: ${gradingSubmission.studentName}`}
          subtitle={`Roll: ${gradingSubmission.studentRoll} • Assignment: ${selectedAssignment.title}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Score / Marks Awarded (Max: {selectedAssignment.maxMarks}) *
              </label>
              <input
                type="number"
                min="0"
                max={selectedAssignment.maxMarks}
                value={gradeMarks}
                onChange={(e) => setGradeMarks(Number(e.target.value))}
                className="input-base"
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Qualitative Feedback for Student
              </label>
              <textarea
                rows={3}
                placeholder="Specific guidance, code review comments, algorithm optimization notes..."
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                className="input-base"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-outline" onClick={() => setGradingSubmission(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCommitGrade}>
                Save Grade & Notify Student
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
