import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Assignment, Submission } from '../types';

export function useAssignments(params?: { sectionCourseId?: string; courseId?: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.assignments.list(params);
      setAssignments(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [params?.sectionCourseId, params?.courseId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const fetchSubmissions = useCallback(async (asgId: string): Promise<Submission[]> => {
    try {
      const res = await api.assignments.submissions(asgId);
      return Array.isArray(res) ? res : (res as any)?.data || [];
    } catch {
      return [];
    }
  }, []);

  const createAssignment = async (data: {
    sectionCourseId: string;
    title: string;
    description?: string;
    maxMarks: number;
    dueDate: string;
    allowLate?: boolean;
  }) => {
    const res = await api.assignments.create(data);
    await fetchAssignments();
    return res;
  };

  const submitAssignment = async (asgId: string, data: { fileUrl?: string; notes?: string }) => {
    const res = await api.assignments.submit(asgId, data);
    return res;
  };

  const gradeSubmission = async (
    submissionId: string,
    data: { marksAwarded: number; feedback?: string; reason: string }
  ) => {
    const res = await api.assignments.grade(submissionId, data);
    return res;
  };

  return {
    assignments,
    loading,
    error,
    fetchSubmissions,
    createAssignment,
    submitAssignment,
    gradeSubmission,
    refetch: fetchAssignments,
  };
}
