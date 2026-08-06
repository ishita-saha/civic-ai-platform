import { createContext, useContext } from 'react';

// Lives apart from the provider component so Fast Refresh keeps working —
// a module that exports both a component and a hook loses its refresh boundary.
export const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
