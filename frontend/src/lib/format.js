/** "Dr. Ananya Sen" -> "AS". Falls back to a dash so the avatar is never blank. */
export function initials(name) {
  if (!name) return '—';
  const parts = String(name)
    .replace(/\b(dr|er|eng|mr|mrs|ms|sub-eng|exec)\.?\s/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '—';
  return (parts[0][0] + (parts.at(-1)[0] || '')).toUpperCase();
}

export function coords(item) {
  const g = item?.geotag;
  if (typeof g?.lat !== 'number' || typeof g?.lng !== 'number') return null;
  return `${g.lat.toFixed(4)}° N, ${g.lng.toFixed(4)}° E`;
}

export function placeName(item) {
  return item?.location || 'Location not recorded';
}

export function mapsUrl(item) {
  const g = item?.geotag;
  if (typeof g?.lat !== 'number') return null;
  return `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`;
}

export function caseId(item, index) {
  return item?.id != null ? String(item.id) : `CMP-${index + 101}`;
}

/**
 * The backend hands back whatever the client sent — a locale string, an ISO
 * string, or nothing. Parse what we can, show the raw value when we can't,
 * and never render "Invalid Date".
 */
export function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Buckets a free-text status into one of our three semantic lanes. */
export function statusOf(item) {
  const s = String(item?.status || '').toLowerCase();
  if (/(resolved|completed|solved|closed)/.test(s)) return 'resolved';
  if (/progress|assigned|active/.test(s)) return 'progress';
  return 'pending';
}
