import { useLayoutEffect, useRef } from 'react';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Slide list items between positions when the list reorders (FLIP).
 *
 * Returns a ref for the container. Every child that should slide carries
 * `data-flip-key` with a stable id — React reuses those DOM nodes across a
 * re-sort, which is the whole reason the technique works.
 *
 * On this screen it is not decoration. The feed's claim is that backing a
 * report moves it up the corporation's queue; watching the card you just
 * pressed climb past its neighbours is that claim, demonstrated. Reordering
 * instantly just makes the list look like it flickered.
 *
 * How it works: React has already painted the new order by the time a layout
 * effect runs, so we compare each node's new box against the one recorded last
 * render, then animate it from the old position back to none. The element never
 * actually moves — it starts displaced and settles.
 */
export function useFlip({ duration = 460 } = {}) {
  const ref = useRef(null);
  const previous = useRef(new Map());
  const running = useRef(new WeakMap());

  // No dependency array on purpose: this has to re-measure after every render,
  // or a render that changed layout without changing order (a card's text
  // rewrapping, a badge appearing) would leave stale boxes behind and the next
  // real reorder would animate from a position the card was never in.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll('[data-flip-key]'));

    // Clear any slide still in flight so the boxes below are true layout
    // positions rather than half-applied transforms. An interruption inside the
    // animation window costs a small jump; re-sorting twice inside 460ms is
    // rare enough to be worth the much simpler measurement.
    for (const node of nodes) running.current.get(node)?.cancel();

    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const next = new Map();

    for (const node of nodes) {
      const key = node.dataset.flipKey;
      const box = node.getBoundingClientRect();
      next.set(key, box);

      if (still) continue;

      // No previous box means the item is new to the list — it gets its own
      // entrance animation instead of sliding in from nowhere.
      const was = previous.current.get(key);
      if (!was) continue;

      const dx = was.left - box.left;
      const dy = was.top - box.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      const animation = node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration, easing: EASE },
      );
      running.current.set(node, animation);
    }

    previous.current = next;
  });

  // A resize moves every card legitimately. Without this the next reorder would
  // replay the resize as though the cards had changed rank.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const remeasure = () => {
      const fresh = new Map();
      for (const node of root.querySelectorAll('[data-flip-key]')) {
        fresh.set(node.dataset.flipKey, node.getBoundingClientRect());
      }
      previous.current = fresh;
    };

    window.addEventListener('resize', remeasure);
    return () => window.removeEventListener('resize', remeasure);
  }, []);

  return ref;
}
