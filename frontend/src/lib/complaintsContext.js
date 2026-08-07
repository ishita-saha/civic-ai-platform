import { createContext, useContext } from 'react';

// Split from the provider component so Fast Refresh keeps its boundary — same
// reason authContext and toastContext live apart from theirs.
export const ComplaintsContext = createContext(null);

export function useComplaints() {
  const ctx = useContext(ComplaintsContext);
  if (!ctx) throw new Error('useComplaints must be used inside <ComplaintsProvider>');
  return ctx;
}
