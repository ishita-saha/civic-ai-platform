import { useCallback, useEffect, useRef, useState } from 'react';
import { getComplaint, readableError } from './api';

/**
 * Loads one case by reference, for the two detail pages.
 *
 * Fetches rather than reading the list out of ComplaintsContext, because these
 * pages have real URLs now: someone can open `/complaint/42` in a fresh tab
 * with no list loaded. `getComplaint` already falls back to the list when the
 * backend has no per-id route, so this stays one code path either way.
 *
 * Distinguishes "no such case" (`missing`) from "couldn't reach the server"
 * (`error`) — they need different words on screen and different buttons.
 */
export function useComplaint(id) {
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(false);

  // Guards against a slow response for a previous id overwriting a newer one
  // when the user moves between cases faster than the network answers.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++requestId.current;
    setLoading(true);
    setError(null);
    setMissing(false);

    try {
      const data = await getComplaint(id);
      if (ticket !== requestId.current) return;
      setComplaint(data);
    } catch (err) {
      if (ticket !== requestId.current) return;
      setComplaint(null);
      if (err?.notFound) setMissing(true);
      else setError(readableError(err));
    } finally {
      if (ticket === requestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    // Any in-flight request for the old id is now stale.
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return { complaint, setComplaint, loading, error, missing, reload: load };
}
