import { useCallback, useEffect, useMemo, useState } from 'react';
import { listComplaints, readableError } from '../lib/api';
import { ComplaintsContext } from '../lib/complaintsContext';
import { useToast } from '../lib/toastContext';

/**
 * One fetch of `/complaints`, shared by every route that needs it.
 *
 * Before the router landed, App.jsx owned this state and drilled it into the
 * three tabs. Now the dashboard, the analytics page, the tracker and the public
 * gallery all want the same list, and none of them are siblings any more — so
 * it lives here instead of being refetched per route.
 */
export function ComplaintsProvider({ children }) {
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(
    async ({ announce = false } = {}) => {
      setLoading(true);
      try {
        setComplaints(await listComplaints());
        setError(null);
        setLastUpdated(new Date());
        if (announce) toast.success('Up to date', 'Latest cases pulled from the server.');
      } catch (err) {
        const message = readableError(err);
        setError(message);
        toast.error('Could not load cases', message);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Patch one case in place after an edit, so the table the user came from is
   * already correct when they navigate back — no refetch, no flash of stale
   * data. Merges rather than replaces because the backend's response carries
   * fewer fields than the record the report form originally posted.
   */
  const patchOne = useCallback((id, changes) => {
    setComplaints((list) =>
      list.map((c) => (String(c.id) === String(id) ? { ...c, ...changes } : c)),
    );
  }, []);

  const value = useMemo(
    () => ({ complaints, loading, error, lastUpdated, refresh, patchOne }),
    [complaints, loading, error, lastUpdated, refresh, patchOne],
  );

  return <ComplaintsContext.Provider value={value}>{children}</ComplaintsContext.Provider>;
}
