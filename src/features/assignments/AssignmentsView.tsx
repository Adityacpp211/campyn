import React, { useState, useEffect } from 'react';
import { Assignment, Submission, User } from '../../types';
import { useAssignments } from '../../hooks/useAssignments';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Loader2, RefreshCw, PlusCircle, UploadCloud, Download, FileCheck2 } from 'lucide-react';
import { hasPermission, PERMISSIONS } from '../../services/rbac';
import { useToast } from '../../context/ToastContext';
import { exportToCsv } from '../../utils/exportCsv';
import { CreateAssignmentModal } from './CreateAssignmentModal';
import { SubmitAssignmentModal } from './SubmitAssignmentModal';

interface AssignmentsViewProps {
  currentUser: User;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({ currentUser }) => {
  const { toast } = useToast();
  const {
    assignments,
    loading,
    error,
    fetchSubmissions,
    gradeSubmission,
    refetch,
  } = useAssignments();

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);

  // Grading State
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeMarks, setGradeMarks] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [gradeReason, setGradeReason] = useState<string>('Evaluation completed based on rubric criteria');
  const [isGrading, setIsGrading] = useState(false);

  // Permissions
  const canCreate = hasPermission(currentUser.role, PERMISSIONS.ASSIGNMENTS_CREATE);
  const canGrade = hasPermission(currentUser.role, PERMISSIONS.ASSIGNMENTS_GRADE);
  const canSubmit = hasPermission(currentUser.role, PERMISSIONS.ASSIGNMENTS_SUBMIT);

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
    setGradeMarks(sub.marksAwarded ?? 0);
    setGradeFeedback(sub.feedback || '');
    setGradeReason('Evaluation completed based on rubric criteria');
  };

  const handleCommitGrade = async () => {
    if (!gradingSubmission || !selectedAssignment) return;
    if (!gradeReason.trim()) {
      toast.warning('Mandatory audit justification reason is required for grading.');
      return;
    }

    try {
      setIsGrading(true);
      await gradeSubmission(gradingSubmission.id, {
        marksAwarded: Number(gradeMarks),
        feedback: gradeFeedback.trim() || undefined,
        reason: gradeReason.trim(),
      });

      toast.success(
        `Graded ${gradingSubmission.studentName} (${gradeMarks}/${selectedAssignment.maxMarks}) with audit trail`,
        'Evaluation Recorded'
      );

      // Refresh submissions
      const updated = await fetchSubmissions(selectedAssignment.id);
      setSubmissions(updated);
      setGradingSubmission(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record grade');
    } finally {
      setIsGrading(false);
    }
  };

  const handleExportCsv = () => {
    if (!submissions || submissions.length === 0) {
      toast.warning('No submissions found to export.');
      return;
    }
    try {
      exportToCsv(
        `CAMPES_Coursework_${selectedAssignment?.courseCode || 'Assignment'}_${new Date().toISOString().split('T')[0]}`,
        submissions,
        [
          { header: 'Roll Number', accessor: (s) => s.studentRoll },
          { header: 'Student Name', accessor: (s) => s.studentName },
          { header: 'Submitted At', accessor: (s) => s.submittedAt || 'Pending' },
          { header: 'Late Status', accessor: (s) => (s.isLate ? 'LATE' : 'ON-TIME') },
          { header: 'Status', accessor: (s) => (s.status || 'submitted').toUpperCase() },
          { header: 'Marks Awarded', accessor: (s) => (s.marksAwarded !== undefined ? s.marksAwarded : 'Pending') },
          { header: 'Max Marks', accessor: () => selectedAssignment?.maxMarks || 0 },
          { header: 'Feedback', accessor: (s) => s.feedback || '' },
        ]
      );
      toast.success(`Exported ${submissions.length} submission records to CSV.`, 'Export Completed');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Coursework & Assignments
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Course deliverables, programming benchmarks, and cryptographic evaluation ledger
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {submissions.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
              <Download size={13} /> Export CSV
            </button>
          )}

          {canSubmit && selectedAssignment && (
            <button className="btn btn-secondary btn-sm" onClick={() => setIsSubmitOpen(true)}>
              <UploadCloud size={13} /> Submit Deliverable
            </button>
          )}

          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
              <PlusCircle size={13} /> Create Assignment
            </button>
          )}
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
          {canCreate && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={() => setIsCreateOpen(true)}>
              <PlusCircle size={13} /> Publish First Assignment
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Assignment Cards Grid */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Badge variant="default">{asg.courseCode}</Badge>
                      <span style={{ fontSize: '11px', color: 'var(--color-medium-gray)' }}>{asg.courseName}</span>
                    </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-white)' }}>
                  Submissions for {selectedAssignment.courseCode} ({submissions.length})
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--color-medium-gray)' }}>
                  {canGrade ? 'Click Grade to evaluate student submission with cryptographic audit trail' : 'Review submission statuses'}
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
                        {canGrade && <th>Action</th>}
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
                            {sub.submittedAt ? String(sub.submittedAt).split('.')[0].replace('T', ' ') : 'Pending'}
                            {sub.isLate && <Badge variant="danger" style={{ marginLeft: '6px' }}>Late</Badge>}
                          </td>
                          <td>
                            <Badge variant={sub.status === 'graded' ? 'success' : 'warning'}>
                              {(sub.status || 'pending').toUpperCase()}
                            </Badge>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                            {sub.marksAwarded !== undefined && sub.marksAwarded !== null ? `${sub.marksAwarded} / ${selectedAssignment.maxMarks}` : '—'}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--color-light-gray)', maxWidth: '240px' }}>
                            {sub.feedback || 'No feedback recorded.'}
                          </td>
                          {canGrade && (
                            <td>
                              <button className="btn btn-outline btn-sm" onClick={() => handleOpenGrade(sub)}>
                                <FileCheck2 size={12} /> {sub.status === 'graded' ? 'Edit Grade' : 'Grade'}
                              </button>
                            </td>
                          )}
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

      {/* Evaluation & Grading Modal */}
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

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Mandatory Audit Justification Reason *
              </label>
              <input
                type="text"
                placeholder="e.g. Solution passed 10/10 automated test suites with O(log n) tree depth"
                value={gradeReason}
                onChange={(e) => setGradeReason(e.target.value)}
                className="input-base"
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-outline" onClick={() => setGradingSubmission(null)} disabled={isGrading}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCommitGrade} disabled={isGrading}>
                {isGrading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Submitting Audit...
                  </>
                ) : (
                  'Save Grade & Append Audit Log'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Creation Modal */}
      <CreateAssignmentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => refetch()}
      />

      {/* Submission Modal for Students */}
      <SubmitAssignmentModal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        assignment={selectedAssignment}
        onSubmitted={() => {
          if (selectedAssignment) {
            fetchSubmissions(selectedAssignment.id).then((subs) => setSubmissions(subs));
          }
        }}
      />
    </div>
  );
};
