import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';

export interface UseAuditLogsOptions {
  action?: string;
  entity?: string;
  actorEmail?: string;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<{
    loading: boolean;
    verified: boolean;
    isValid?: boolean;
    totalRecords?: number;
    error?: string;
  }>({ loading: false, verified: false });

  const { action, entity, actorEmail } = options;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.audit.list({ action, entity, actorEmail });
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [action, entity, actorEmail]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const verifyIntegrity = async () => {
    setVerifyState({ loading: true, verified: false });
    try {
      const res = await api.audit.verify();
      setVerifyState({
        loading: false,
        verified: true,
        isValid: res.isValid,
        totalRecords: res.totalRecords,
        error: res.error,
      });
      return res;
    } catch (err: any) {
      const res = { loading: false, verified: true, isValid: false, error: err.message };
      setVerifyState(res);
      return res;
    }
  };

  return {
    logs,
    loading,
    error,
    verifyState,
    verifyIntegrity,
    refetch: fetchLogs,
  };
}
