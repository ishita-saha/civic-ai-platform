/**
 * The Spotit mark: a map pin whose head is the tricolour and whose centre is
 * the spot itself.
 *
 * Drawn rather than imported so it inherits `currentColor` for the pin body
 * and picks the three bands straight off the theme tokens — which means it is
 * the same mark in both themes without shipping two files, and it stays legible
 * on the dark canvas where a flat saffron logo would glare.
 *
 * The bands are clipped to the pin's head, not painted as a striped square
 * behind it. A flag in a box is a sticker; a flag *as* the object is a mark.
 */
export default function Logo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="spotit-head">
          <circle cx="16" cy="13" r="9" />
        </clipPath>
      </defs>

      {/* Pin body — the silhouette, in the caller's colour. */}
      <path
        d="M16 30c0 0-10-9.2-10-16.4A10 10 0 0 1 26 13.6C26 20.8 16 30 16 30Z"
        fill="currentColor"
      />

      {/* Three bands across the head. Horizontal, in flag order. */}
      <g clipPath="url(#spotit-head)">
        <rect x="6" y="4" width="20" height="6" fill="var(--c-tri-1)" />
        <rect x="6" y="10" width="20" height="6" fill="var(--c-tri-2)" />
        <rect x="6" y="16" width="20" height="6" fill="var(--c-tri-3)" />
      </g>

      {/* The chakra, and the "spot" the name is about. Small enough that at
          favicon size it reads as a dot rather than a smudge. */}
      <circle cx="16" cy="13" r="3.1" fill="var(--c-tri-4)" />
      <circle cx="16" cy="13" r="1.15" fill="var(--c-tri-2)" />
    </svg>
  );
}
