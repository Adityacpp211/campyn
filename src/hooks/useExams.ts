import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Examination, MarksEntry } from '../types';

export function useExams() {
  const [exams, setExams] = useState<Examination[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.exams.list();
      setExams(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load examinations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const fetchMarks = useCallback(async (examId: string): Promise<MarksEntry[]> => {
    try {
      const res = await api.exams.marks(examId);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  }, []);

  const updateMarks = async (id: string, marksObtained: number, grade: string, reason: string) => {
    return await api.exams.updateMarks(id, marksObtained, grade, reason);
  };

  const toggleLock = async (examId: string) => {
    const res = await api.exams.toggleLock(examId);
    await fetchExams();
    return res;
  };

  return {
    exams,
    loading,
    error,
    fetchMarks,
    updateMarks,
    toggleLock,
    refetch: fetchExams,
  };
}
