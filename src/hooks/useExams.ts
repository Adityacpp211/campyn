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
      setExams(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load examinations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const createExam = async (data: {
    semesterId: string;
    title: string;
    examType: 'internal' | 'midterm' | 'final' | 'lab';
  }) => {
    const res = await api.exams.create(data);
    await fetchExams();
    return res;
  };

  const fetchMarks = useCallback(async (examId: string): Promise<MarksEntry[]> => {
    try {
      const res = await api.exams.marks(examId);
      return Array.isArray(res) ? res : (res as any)?.data || [];
    } catch {
      return [];
    }
  }, []);

  const populateRoster = async (examId: string, data: { courseId: string; maxMarks?: number }) => {
    const res = await api.exams.populateRoster(examId, data);
    return res;
  };

  const updateMarks = async (id: string, marksObtained: number, grade?: string, reason?: string) => {
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
    createExam,
    fetchMarks,
    populateRoster,
    updateMarks,
    toggleLock,
    refetch: fetchExams,
  };
}
