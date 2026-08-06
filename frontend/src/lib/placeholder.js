/**
 * Obviously-fake placeholder art, generated as an inline SVG data URI.
 *
 * The demo cases used to point at Unsplash photos of unrelated things — a
 * chrome tap standing in for a streetlight repair, an abstract blur for road
 * resurfacing. A picture that argues with its caption is worse than no picture:
 * it teaches people not to trust the evidence column, which is the one column
 * this product exists to make trustworthy.
 *
 * So these are stamped TEST and cannot be mistaken for a real photograph.
 * They disappear on their own once the backend stores uploads — see
 * ARCHITECTURE.md → "Reality check".
 */

const TONES = {
  before: { bg: '#3c3126', ink: '#f0c99a', accent: '#b4762e' },
  after: { bg: '#1f3328', ink: '#a8e0bd', accent: '#2f7d51' },
  neutral: { bg: '#2b2b33', ink: '#c9c7d2', accent: '#6b6878' },
};

/**
 * @param {'before'|'after'|'neutral'} phase  which half of the pair this is
 * @param {string} caption                   short line under the TEST mark
 */
export function testPhoto(phase = 'neutral', caption = '') {
  const t = TONES[phase] ?? TONES.neutral;
  const title = phase === 'neutral' ? 'PLACEHOLDER' : phase.toUpperCase();

  // Hazard stripes make it read as "not a real image" at thumbnail size, where
  // the text is far too small to be legible.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" role="img">
<defs>
<pattern id="s" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<rect width="28" height="28" fill="${t.bg}"/>
<rect width="14" height="28" fill="${t.accent}" opacity="0.14"/>
</pattern>
</defs>
<rect width="480" height="320" fill="url(#s)"/>
<rect x="10" y="10" width="460" height="300" fill="none" stroke="${t.accent}" stroke-width="2" stroke-dasharray="10 8" opacity="0.65"/>
<text x="240" y="150" fill="${t.ink}" font-family="ui-monospace, Consolas, monospace" font-size="72" font-weight="700" letter-spacing="10" text-anchor="middle">TEST</text>
<text x="240" y="190" fill="${t.ink}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="21" font-weight="600" letter-spacing="4" text-anchor="middle" opacity="0.85">${title}</text>
${
  caption
    ? `<text x="240" y="222" fill="${t.ink}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" text-anchor="middle" opacity="0.6">${escapeXml(caption)}</text>`
    : ''
}
<text x="240" y="286" fill="${t.ink}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" text-anchor="middle" opacity="0.45">not a real photograph</text>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(s) {
  return String(s).replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c],
  );
}
