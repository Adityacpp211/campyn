import React, { useState } from 'react';
import { useAttendance } from '../../hooks/useAttendance';
import { User, AttendanceRecord, GlobalFilterState } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ShieldAlert, History, Lock, Unlock, Loader2, Calendar, Download, PlusCircle } from 'lucide-react';
import { api } from '../../services/api';
import { hasPermission, PERMISSIONS } from '../../services/rbac';
import { TakeAttendanceModal } from './TakeAttendanceModal';
import { exportToCsv } from '../../utils/exportCsv';
import { useToast } from '../../context/ToastContext';

interface AttendanceViewProps {
  currentUser: User;
  filter?: GlobalFilterState;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ currentUser, filter: _filter }) => {
  const { toast } = useToast();
  const {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    selectedSession,
    records,
    loading,
    recordsLoading,
    error,
    updateRecord,
    lockSession,
    submitCorrection,
    refetchSessions,
  } = useAttendance();

  const [isTakeAttendanceOpen, setIsTakeAttendanceOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [editReason, setEditReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const canApproveOrLock =
    hasPermission(currentUser.role, PERMISSIONS.ATTENDANCE_APPROVE) ||
    currentUser.role === 'COLLEGE_ADMIN' ||
    currentUser.role === 'HOD' ||
    currentUser.role === 'PRINCIPAL';

  const isSessionLocked = selectedSession?.isLocked ?? false;

  const handleOpenEdit = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setNewStatus(rec.status);
    setEditReason('');
  };

  const handleCommitEdit = async () => {
    if (!editingRecord || !editReason.trim() || editReason.trim().length < 5) {
      toast.warning('A valid justification reason (minimum 5 characters) is mandatory for auditable attendance edits.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isSessionLocked) {
        // If session is locked, submit as an official attendance correction request for governance approval
        await submitCorrection(editingRecord.id, newStatus, editReason);
        toast.success('Attendance correction request successfully submitted to governance approvals ledger.', 'Correction Submitted');
      } else {
        // Direct update with cryptographic audit trail
        await updateRecord(editingRecord.id, newStatus, editReason);
        toast.success(`Updated status of ${editingRecord.studentName} to ${newStatus.toUpperCase()}`, 'Record Updated');
      }
      setEditingRecord(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update attendance record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockSession = async () => {
    if (!selectedSessionId) return;
    const confirmLock = window.confirm(
      'Are you sure you want to permanently lock this attendance session? Once locked, attendance becomes immutable and any further adjustments require two-tier administrative governance approval.'
    );
    if (!confirmLock) return;

    try {
      setIsLocking(true);
      await lockSession(selectedSessionId);
      toast.success('Attendance session has been permanently locked and finalized.', 'Session Locked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to lock attendance session');
    } finally {
      setIsLocking(false);
    }
  };

  const openAuditHistory = async () => {
    try {
      const logs = await api.audit.list({ action: 'ATTENDANCE_CHANGE' });
      setAuditLogs(logs);
      setShowHistory(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load audit trail');
    }
  };

  const handleExportCsv = () => {
    if (!records || records.length === 0) {
      toast.warning('No attendance records available in active session to export.');
      return;
    }
    try {
      exportToCsv(
        `CAMPES_Attendance_${selectedSession?.sessionDate || 'Session'}_${selectedSessionId?.slice(0, 8) || 'export'}`,
        records,
        [
          { header: 'Student Name', accessor: (r) => r.studentName },
          { header: 'Roll Number', accessor: (r) => r.studentRoll },
          { header: 'Attendance Status', accessor: (r) => r.status.toUpperCase() },
          { header: 'Session Date', accessor: () => selectedSession?.sessionDate || '' },
          { header: 'Subject / Offering', accessor: () => `${selectedSession?.courseCode || ''} ${selectedSession?.courseName || ''}` },
          { header: 'Section', accessor: () => selectedSession?.sectionName || '' },
          { header: 'Session Locked', accessor: () => (selectedSession?.isLocked ? 'LOCKED' : 'OPEN') },
        ]
      );
      toast.success(`Exported ${records.length} attendance records to CSV.`, 'Export Completed');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  const presentCount = records.filter((r) => r.status === 'present').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const lateCount = records.filter((r) => r.status === 'late').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)' }}>
            Auditable Attendance System
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>
            Authoritative session roster recording with cryptographic lock & governance corrections
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Download size={13} />
            Export CSV
          </button>
          <button className="btn btn-outline btn-sm" onClick={openAuditHistory} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <History size={13} /> Audit Trail
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsTakeAttendanceOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <PlusCircle size={13} />
            Take Attendance
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: '#f87171', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Session Selector & Active Session Meta Banner */}
      <div
        style={{
          padding: '16px',
          backgroundColor: 'var(--color-dark-charcoal)',
          border: '1px solid var(--color-border-gray)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="var(--color-light-gray)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-white)' }}>
              Active Lecture Session:
            </span>
            <select
              value={selectedSessionId || ''}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="input-base"
              style={{ width: 'auto', minWidth: '280px', padding: '6px 12px', fontSize: '13px' }}
              disabled={loading || sessions.length === 0}
            >
              {sessions.length === 0 ? (
                <option value="">No sessions scheduled</option>
              ) : (
                sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.courseCode} ({s.sectionName}) — {new Date(s.sessionDate).toLocaleDateString()} [{s.slot}] {s.isLocked ? '🔒 Locked' : '🟢 Open'}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedSession && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge variant={selectedSession.isLocked ? 'danger' : 'success'}>
                {selectedSession.isLocked ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> LOCKED / FINALIZED
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Unlock size={12} /> OPEN FOR MARKING
                  </span>
                )}
              </Badge>

              {!selectedSession.isLocked && canApproveOrLock && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ borderColor: 'var(--color-danger-border)', color: '#ff8a80' }}
                  onClick={handleLockSession}
                  disabled={isLocking}
                >
                  {isLocking ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                  <span>Lock & Finalize Session</span>
                </button>
              )}
            </div>
          )}
        </div>

        {selectedSession && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '10px',
              borderTop: '1px solid var(--color-border-gray)',
              fontSize: '12px',
              color: 'var(--color-light-gray)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <strong style={{ color: 'var(--color-white)' }}>Course:</strong> {selectedSession.courseName} ({selectedSession.courseCode}) •{' '}
              <strong style={{ color: 'var(--color-white)' }}>Section:</strong> {selectedSession.sectionName}
            </div>
            <div>
              <strong style={{ color: 'var(--color-white)' }}>Scheduled Slot:</strong> {selectedSession.slot} •{' '}
              <strong style={{ color: 'var(--color-white)' }}>Instructor:</strong> {selectedSession.recordedBy}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div className="surface-card">
          <span className="text-secondary" style={{ fontSize: '11px' }}>ROSTER COUNT</span>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-white)', marginTop: '4px' }}>
            {records.length} Students
          </div>
        </div>
        <div className="surface-card">
          <span className="text-secondary" style={{ fontSize: '11px' }}>PRESENT</span>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#81C784', marginTop: '4px' }}>
            {presentCount} ({records.length > 0 ? ((presentCount / records.length) * 100).toFixed(0) : 0}%)
          </div>
        </div>
        <div className="surface-card">
          <span className="text-secondary" style={{ fontSize: '11px' }}>ABSENT</span>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#E57373', marginTop: '4px' }}>
            {absentCount}
          </div>
        </div>
        <div className="surface-card">
          <span className="text-secondary" style={{ fontSize: '11px' }}>LATE / EXCUSED</span>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#FFB74D', marginTop: '4px' }}>
            {lateCount}
          </div>
        </div>
      </div>

      {/* Attendance Roster Grid */}
      <div className="table-container">
        {loading || recordsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'var(--color-medium-gray)' }}>
            <Loader2 size={24} className="animate-spin" />
            <span style={{ marginLeft: '10px', fontSize: '13px' }}>Loading session roster...</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Student Name</th>
                <th>Recorded Status</th>
                <th>Recorded At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-medium-gray)' }}>
                    {sessions.length === 0 ? 'No attendance sessions found.' : 'No student records associated with this session.'}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-white)' }}>
                      {r.studentRoll}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--color-off-white)' }}>
                      {r.studentName}
                    </td>
                    <td>
                      <Badge
                        variant={
                          r.status === 'present'
                            ? 'success'
                            : r.status === 'absent'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {r.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-medium-gray)' }}>
                      {new Date(r.recordedAt).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleOpenEdit(r)}
                      >
                        {isSessionLocked ? 'Request Correction' : 'Edit Record'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mandatory Audit Modification Modal */}
      {editingRecord && (
        <Modal
          isOpen={!!editingRecord}
          onClose={() => setEditingRecord(null)}
          title={isSessionLocked ? `Request Regularization: ${editingRecord.studentName}` : `Auditable Correction: ${editingRecord.studentName}`}
          subtitle={`Current Status: ${editingRecord.status.toUpperCase()} • Roll: ${editingRecord.studentRoll} • Session: ${selectedSession?.courseCode || 'Lecture'}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: isSessionLocked ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
                border: `1px solid ${isSessionLocked ? 'var(--color-danger-border)' : 'var(--color-warning-border)'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: isSessionLocked ? '#FFA4A4' : '#FFB74D',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <ShieldAlert size={16} />
              <span>
                {isSessionLocked
                  ? 'This session is finalized. Submitting this change requires institutional governance approval before applying.'
                  : 'Silent modifications are forbidden. This edit will be permanently recorded in the append-only cryptographic audit log.'}
              </span>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                New Attendance Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="input-base"
              >
                <option value="present">PRESENT</option>
                <option value="absent">ABSENT</option>
                <option value="late">LATE</option>
                <option value="excused">EXCUSED (Medical / Authorized Duty)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-light-gray)', display: 'block', marginBottom: '6px' }}>
                Mandatory Justification / Reason *
              </label>
              <textarea
                rows={3}
                placeholder="State the official rationale (e.g. Student submitted signed medical certificate)..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="input-base"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingRecord(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCommitEdit}
                disabled={isSubmitting || !editReason.trim() || editReason.trim().length < 5}
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isSessionLocked ? (
                  'Submit Regularization Ticket'
                ) : (
                  'Commit Audited Edit'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Audit History Modal */}
      {showHistory && (
        <Modal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          title="Attendance Mutation Ledger"
          subtitle="Cryptographically verified SHA-256 historical audit stream"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
            {auditLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-medium-gray)' }}>
                No attendance modifications recorded.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '10px',
                    border: '1px solid var(--color-border-gray)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-near-black)',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-white)' }}>{log.actorEmail || 'System'}</span>
                    <span style={{ color: 'var(--color-medium-gray)' }}>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--color-light-gray)' }}>
                    <strong>Reason:</strong> {log.reason}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-medium-gray)', marginTop: '4px' }}>
                    HASH: {log.recordHash ? log.recordHash.substring(0, 24) : 'N/A'}...
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Take Attendance New Session Modal */}
      <TakeAttendanceModal
        isOpen={isTakeAttendanceOpen}
        onClose={() => setIsTakeAttendanceOpen(false)}
        onSessionCreated={async (newId) => {
          await refetchSessions();
          if (newId) {
            setSelectedSessionId(newId);
          }
        }}
      />
    </div>
  );
};
