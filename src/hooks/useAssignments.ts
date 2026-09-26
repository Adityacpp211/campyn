import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Assignment, Submission } from '../types';

export function useAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.assignments.list();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const fetchSubmissions = useCallback(async (asgId: string): Promise<Submission[]> => {
    try {
      const subs = await api.assignments.submissions(asgId);
      return Array.isArray(subs) ? subs : [];
    } catch {
      return [];
    }
  }, []);

  return {
    assignments,
    loading,
    error,
    fetchSubmissions,
    refetch: fetchAssignments,
  };
}
