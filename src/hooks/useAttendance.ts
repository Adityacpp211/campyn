import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { AttendanceSession, AttendanceRecord } from '../types';

export interface UseAttendanceOptions {
  sectionCourseId?: string;
  date?: string;
  facultyId?: string;
}

export function useAttendance(initialSessionId?: string, options?: UseAttendanceOptions) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(initialSessionId);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { sectionCourseId, date, facultyId } = options || {};

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.attendance.sessions({ sectionCourseId, date, facultyId });
      setSessions(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance sessions');
      return [];
    }
  }, [sectionCourseId, date, facultyId]);

  const fetchRecords = useCallback(async (sId?: string) => {
    if (!sId) {
      setRecords([]);
      return [];
    }
    setRecordsLoading(true);
    try {
      const data = await api.attendance.records(sId);
      setRecords(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance records');
      return [];
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  // Initial load of sessions
  useEffect(() => {
    setLoading(true);
    fetchSessions().then((fetchedSessions) => {
      if (!initialSessionId && fetchedSessions && fetchedSessions.length > 0) {
        setSelectedSessionId(fetchedSessions[0].id);
      }
    }).finally(() => {
      setLoading(false);
    });
  }, [fetchSessions, initialSessionId]);

  // Load records whenever selectedSessionId changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchRecords(selectedSessionId);
    } else {
      setRecords([]);
    }
  }, [selectedSessionId, fetchRecords]);

  const updateRecord = async (recordId: string, status: string, reason: string) => {
    const updated = await api.attendance.updateRecord(recordId, status, reason);
    if (selectedSessionId) {
      await fetchRecords(selectedSessionId);
    }
    return updated;
  };

  const lockSession = async (sId?: string) => {
    const targetId = sId || selectedSessionId;
    if (!targetId) throw new Error('No session selected to lock');
    const result = await api.attendance.lockSession(targetId);
    await fetchSessions();
    if (selectedSessionId) {
      await fetchRecords(selectedSessionId);
    }
    return result;
  };

  const submitCorrection = async (recordId: string, newStatus: string, reason: string) => {
    const result = await api.attendance.submitCorrection(recordId, newStatus, reason);
    if (selectedSessionId) {
      await fetchRecords(selectedSessionId);
    }
    return result;
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  return {
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
    refetchSessions: fetchSessions,
    refetchRecords: () => fetchRecords(selectedSessionId),
  };
}
