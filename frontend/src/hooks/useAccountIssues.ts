import { useCallback, useEffect, useState } from 'react';
import { PlaidService } from '../services/PlaidService';
import type { AccountIssue } from '../types/api';
import { ACCOUNTS_CHANGED_EVENT } from '../utils/events';

export interface UseAccountIssuesResult {
  issues: AccountIssue[];
  hasIssues: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAccountIssues(): UseAccountIssuesResult {
  const [issues, setIssues] = useState<AccountIssue[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      const statusResponse = await PlaidService.getStatus();
      const connections = Array.isArray(statusResponse?.connections)
        ? statusResponse.connections
        : [];

      const detectedIssues: AccountIssue[] = [];

      for (const conn of connections) {
        const isError =
          conn.status === 'error' ||
          conn.status === 'needs_reauth' ||
          !conn.is_connected ||
          Boolean(conn.error_message);

        if (isError) {
          const status =
            conn.status === 'needs_reauth'
              ? 'needs_reauth'
              : conn.status === 'error' || !conn.is_connected
                ? 'error'
                : 'error';

          detectedIssues.push({
            id: conn.connection_id || 'unknown',
            institutionName: conn.institution_name || 'Bank Connection',
            status,
            errorMessage:
              conn.error_message ||
              (status === 'needs_reauth'
                ? 'Requires re-authentication'
                : !conn.is_connected
                  ? 'Account disconnected'
                  : 'Connection issue'),
            lastSyncAt: conn.last_sync_at,
          });
        }
      }

      setIssues(detectedIssues);
    } catch {
      // If unauthenticated or offline, ignore error gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIssues();

    if (typeof window !== 'undefined') {
      window.addEventListener(ACCOUNTS_CHANGED_EVENT, fetchIssues);
      return () => {
        window.removeEventListener(ACCOUNTS_CHANGED_EVENT, fetchIssues);
      };
    }
  }, [fetchIssues]);

  return {
    issues,
    hasIssues: issues.length > 0,
    loading,
    refresh: fetchIssues,
  };
}
