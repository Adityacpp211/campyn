import React, { useState, useEffect } from 'react';
import { User, Examination, MarksEntry } from '../../types';
import { useExams } from '../../hooks/useExams';
import { Badge } from '../../components/ui/Badge';
import { Award, Lock, ShieldCheck, AlertCircle, Loader2, RefreshCw, PlusCircle, Download, Edit3, UserCheck } from 'lucide-react';
import { hasPermission, PERMISSIONS } from '../../services/rbac';
import { useToast } from '../../context/ToastContext';
import { exportToCsv } from '../../utils/exportCsv';
import { CreateExamModal } from './CreateExamModal';
import { EnterMarksModal } from './EnterMarksModal';

interface ExamsViewProps {
  currentUser: User;
}

export const ExamsView: React.FC<ExamsViewProps> = ({ currentUser }) => {
  const { toast } = useToast();
  const {
    exams,
    loading: examsLoading,
    error: examsError,
    fetchMarks,
    updateMarks,
    toggleLock,
    refetch,
  } = useExams();

  const [selectedExam, setSelectedExam] = useState<Examination | null>(null);
  const [marks, setMarks] = useState<MarksEntry[]>([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MarksEntry | null>(null);

  const canLockPublish = hasPermission(currentUser.role, PERMISSIONS.MARKS_LOCK_PUBLISH);
  const canEnter = hasPermission(currentUser.role, PERMISSIONS.MARKS_ENTER);

  useEffect(() => {
    if (exams.length > 0 && !selectedExam) {
      setSelectedExam(exams[0]);
    }
  }, [exams, selectedExam]);

  useEffect(() => {
    if (selectedExam) {
      setMarksLoading(true);
      fetchMarks(selectedExam.id)
        .then((data) => setMarks(data))
        .finally(() => setMarksLoading(false));
    } else {
      setMarks([]);
    }
  }, [selectedExam, fetchMarks]);

  const handleToggleLock = async (exam: Examination) => {
    if (!canLockPublish) {
      toast.warning(`Access Denied: Role [${currentUser.role}] lacks [marks.lock_publish] permission.`);
      return;
    }

    try {
      setIsTogglingLock(true);
      const res = await toggleLock(exam.id);
      if (res && res.data) {
        setSelectedExam((prev) => (prev ? { ...prev, isLocked: res.data.isLocked, isPublished: res.data.isPublished } : null));
        toast.success(
          res.data.isLocked ? 'Exam marks published and locked in PostgreSQL ledger.' : 'Exam unlocked for grade revisions.',
          'Exam Lock Updated'
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update exam lock status');
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleSaveMarks = async (id: string, marksObtained: number, grade: string, reason: string) => {
    await updateMarks(id, marksObtained, grade, reason);
    if (selectedExam) {
      const refreshed = await fetchMarks(selectedExam.id);
      setMarks(refreshed);
    }
  };

  const handleExportCsv = () => {
    if (!marks || marks.length === 0) {
      toast.warning('No marks records found to export.');
      return;
    }
    try {
      exportToCsv(
        `CAMPES_Exam_Marks_${selectedExam?.title.replace(/\s+/g, '_') || 'Exam'}_${new Date().toISOString().split('T')[0]}`,
        marks,
        [
          { header: 'Roll Number', accessor: (m) => m.studentRoll },
          { header: 'Student Name', accessor: (m) => m.studentName },
          { header: 'Course Code', accessor: (m) => m.courseCode || '' },
          { header: 'Marks Obtained', accessor: (m) => m.marksObtained },
          { header: 'Maximum Marks', accessor: (m) => m.maxMarks },
          { header: 'Percentage (%)', accessor: (m) => ((m.marksObtained / m.maxMarks) * 100).toFixed(1) },
          { header: 'Letter Grade', accessor: (m) => m.grade },
          { header: 'Verification Status', accessor: (m) => (m.verified ? 'VERIFIED' : 'PROVISIONAL') },
        ]
      );
      toast.success(`Exported ${marks.length} marks entries to CSV.`, 'Export Completed');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Examinations & Marks Verification
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Official institutional assessments, continuous evaluation marks, and audit-locked grades
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {marks.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
              <Download size={13} /> Export Grade Register
            </button>
          )}

          {selectedExam && canLockPublish && (
            <button
              className={`btn btn-sm ${selectedExam.isLocked ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => handleToggleLock(selectedExam)}
              disabled={isTogglingLock}
            >
              <Lock size={13} /> {isTogglingLock ? 'Updating...' : selectedExam.isLocked ? 'Unlock Results' : 'Lock & Publish Results'}
            </button>
          )}

          {canLockPublish && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
              <PlusCircle size={13} /> Schedule Examination
            </button>
          )}
        </div>
      </div>

      {examsError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{examsError}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {examsLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--color-light-gray)', gap: '8px' }}>
          <Loader2 className="animate-spin" size={20} />
          <span>Loading examination registers...</span>
        </div>
      ) : exams.length === 0 ? (
        <div className="surface-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-light-gray)' }}>
          <p>No examination sessions recorded for the active academic calendar.</p>
          {canLockPublish && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={() => setIsCreateOpen(true)}>
              <PlusCircle size={13} /> Schedule First Examination
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Exam Tab Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {exams.map((exam) => {
              const isSelected = selectedExam?.id === exam.id;
              return (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExam(exam)}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {exam.isLocked ? <Lock size={12} /> : <Award size={12} />}
                  <span>{exam.title}</span>
                  <Badge variant={exam.isLocked ? 'success' : 'warning'}>
                    {exam.isLocked ? 'Official & Published' : 'Draft / Grading'}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Examination Status Notice */}
          {selectedExam && (
            selectedExam.isLocked ? (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: '#A5D6A7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={16} />
                <span>Results for this examination are officially locked in PostgreSQL. Any change generates a cryptographic audit record.</span>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-warning-bg)',
                  border: '1px solid var(--color-warning-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: '#FFB74D',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} />
                <span>Draft Grading Mode: Marks entries are provisional until verified and published by the Exam Cell.</span>
              </div>
            )
          )}

          {/* Marks Table */}
          {selectedExam && (
            <div className="table-container">
              {marksLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--color-light-gray)', gap: '8px' }}>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Loading marks entries...</span>
                </div>
              ) : marks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-medium-gray)', fontSize: '13px' }}>
                  No marks entries recorded for this examination yet.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Course</th>
                      <th>Marks Obtained</th>
                      <th>Maximum</th>
                      <th>Grade</th>
                      <th>Audit Status</th>
                      {canEnter && !selectedExam.isLocked && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                          {m.studentRoll}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--color-off-white)' }}>
                          {m.studentName}
                        </td>
                        <td>{m.courseCode || 'Coursework'}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                          {m.marksObtained}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-medium-gray)' }}>
                          {m.maxMarks}
                        </td>
                        <td>
                          <Badge variant="info">{m.grade}</Badge>
                        </td>
                        <td>
                          <Badge variant={selectedExam.isLocked ? 'success' : 'default'}>
                            {selectedExam.isLocked ? 'Immutable' : 'Editable'}
                          </Badge>
                        </td>
                        {canEnter && !selectedExam.isLocked && (
                          <td>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setEditingEntry(m)}
                              title="Enter / Edit Marks"
                            >
                              <Edit3 size={12} /> Grade
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Examination Creation Modal */}
      <CreateExamModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => refetch()}
      />

      {/* Grade Entry Modal */}
      <EnterMarksModal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        entry={editingEntry}
        onSaved={handleSaveMarks}
      />
    </div>
  );
};
