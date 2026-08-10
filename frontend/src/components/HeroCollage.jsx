import { useEffect, useRef } from 'react';
import { ChevronUp, MapPin, ShieldCheck } from 'lucide-react';
import { demoResolved, photoPair } from '../lib/demoData';

/**
 * The hero's moving picture: two case cards drifting over each other, with the
 * backing count and the sign-off floating off their edges.
 *
 * The art is the same generated TEST placeholder the rest of the app uses, on
 * purpose — see `lib/placeholder.js`. A stock photo of a real pothole in the
 * hero would be the one picture on the site pretending to be evidence.
 *
 * Decorative in full: everything shown here is stated again in the copy beside
 * it and in the worked example further down, so the whole block is hidden from
 * assistive tech rather than read out as a second, wordless copy of the pitch.
 *
 * Motion is layered across three independent CSS properties so they compose on
 * one element instead of fighting over `transform`:
 *
 *   translate  → pointer parallax, written from JS as --px / --py
 *   transform  → the idle float keyframes
 *   scale      → the entrance
 */

const [streetlight, road] = demoResolved;
const beforeShot = photoPair(road).before;
const afterShot = photoPair(streetlight).after;

export default function HeroCollage() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Parallax is a pointer affordance. Skip it when motion is unwelcome, and
    // on coarse pointers — a touch screen has no hover, so the handler would
    // only ever fire mid scroll-drag and jerk the cards sideways.
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!fine || still) return;

    let frame = 0;

    const onMove = (event) => {
      if (frame) return;
      // One update per painted frame; pointermove outruns the compositor.
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = el.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        el.style.setProperty('--px', x.toFixed(3));
        el.style.setProperty('--py', y.toFixed(3));
      });
    };

    const onLeave = () => {
      el.style.setProperty('--px', '0');
      el.style.setProperty('--py', '0');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="hero-collage" ref={ref} aria-hidden="true">
      <div className="hc-card hc-before">
        <img src={beforeShot} alt="" loading="lazy" draggable="false" />
        <span className="hc-tag">Reported</span>
        <span className="hc-caption">
          <MapPin size={12} />
          {road.location}
        </span>
      </div>

      <div className="hc-card hc-after">
        <img src={afterShot} alt="" loading="lazy" draggable="false" />
        <span className="hc-tag hc-tag-done">Closed · photo proof</span>
        <span className="hc-caption">
          <ShieldCheck size={12} />
          Signed off by {streetlight.reviewer.name}
        </span>
      </div>

      <span className="hc-pill hc-pill-votes">
        <ChevronUp size={14} />
        <b>12</b> neighbours backed this
      </span>

      <span className="hc-pill hc-pill-sev">
        <i className="hc-dot" />
        High severity
      </span>
    </div>
  );
}
