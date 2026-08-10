import { useEffect, useRef } from 'react';

/**
 * Reveal-on-scroll.
 *
 * Returns a ref for an element carrying `.reveal`. The element gains `.is-in`
 * the first time it crosses into view and keeps it — content that re-hides
 * itself when you scroll back up reads as a bug rather than a flourish.
 *
 * Two things keep this from ever hiding content permanently:
 *
 *   1. The hidden half of `.reveal` lives behind `prefers-reduced-motion:
 *      no-preference` in the stylesheet, so with motion turned off the element
 *      is never hidden and there is nothing for this hook to undo.
 *   2. If IntersectionObserver is missing, the class goes on immediately.
 *
 * Elements already on screen at mount are covered by the observer itself — it
 * fires once on observe, so the hero reveals on load rather than waiting for a
 * scroll that may never come on a short page.
 */
export function useReveal({ threshold = 0.12 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }

    const io = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      // Bottom inset so a section commits to appearing only once it is properly
      // in view, not while its first pixel is still under the fold.
      { threshold, rootMargin: '0px 0px -6% 0px' },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return ref;
}
