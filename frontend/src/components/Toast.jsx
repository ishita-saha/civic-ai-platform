import { useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext } from '../lib/toastContext';

const TONES = {
  success: { icon: CheckCircle2, tone: 'var(--c-ok)' },
  error: { icon: AlertTriangle, tone: 'var(--c-danger)' },
  info: { icon: Info, tone: 'var(--c-brand)' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    // Flag as leaving so the exit animation can play, then unmount.
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 200);
  }, []);

  const push = useCallback(
    (variant, title, msg, ttl = 5000) => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, variant, title, msg }]);
      if (ttl) setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (title, msg) => push('success', title, msg),
      error: (title, msg) => push('error', title, msg, 7000),
      info: (title, msg) => push('info', title, msg),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, tone } = TONES[t.variant] ?? TONES.info;
          return (
            <div
              key={t.id}
              className={`toast${t.leaving ? ' toast-out' : ''}`}
              style={{ '--tone': tone }}
            >
              <Icon size={17} className="toast-icon" aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="toast-title">{t.title}</div>
                {t.msg && <div className="toast-msg">{t.msg}</div>}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
