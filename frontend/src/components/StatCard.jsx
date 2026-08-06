import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Counts up to `value` on mount and on every change. Skipped entirely when the
 * user has asked for reduced motion — the number just snaps.
 */
function useCountUp(value, duration = 650) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      from.current = value;
      return;
    }

    const start = performance.now();
    const origin = from.current;
    let raf;

    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3; // ease-out cubic
      setDisplay(Math.round(origin + (value - origin) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

export default function StatCard({ icon: Icon, label, value, tone, toneSoft, badge, index = 0 }) {
  const shown = useCountUp(value);

  return (
    <div
      className="stat anim-rise"
      style={{ '--tone': tone, '--tone-soft': toneSoft, '--i': index }}
    >
      <div className="stat-top">
        <span className="stat-icon">
          <Icon size={16} aria-hidden="true" />
        </span>
        {badge}
      </div>
      <div className="stat-value">{shown}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
