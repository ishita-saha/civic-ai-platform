import { CATEGORIES } from './demoData';
import { statusOf } from './format';

/**
 * Rollups for the analytics page. Pure functions over the complaint list — the
 * backend has no /analytics endpoint, and for a few hundred cases there is no
 * reason to add one. If the dataset ever outgrows the browser, these signatures
 * are what a server-side version has to reproduce.
 */

/**
 * The fixed slot order behind the categorical chart colours. Slots are assigned
 * by category identity and never by rank, so filtering or re-sorting the chart
 * can't repaint the bars that survive.
 */
export const CATEGORY_ORDER = CATEGORIES.map((c) => c.value);

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.value, c.label]));

/**
 * Maps a free-text category onto one of our six. Anything unrecognised folds
 * into "Other" rather than getting a colour of its own — a generated seventh
 * hue is a colour nobody validated and nobody can tell apart from slot 3.
 */
export function categoryKey(value) {
  if (!value) return 'Other';
  const raw = String(value).trim();
  const hit = CATEGORY_ORDER.find((c) => c.toLowerCase() === raw.toLowerCase());
  return hit || 'Other';
}

export function categoryLabel(key) {
  return CATEGORY_LABEL.get(key) || key;
}

/** Zero-indexed slot for the chart palette. Unknown categories share "Other". */
export function categorySlot(key) {
  const i = CATEGORY_ORDER.indexOf(key);
  return i === -1 ? CATEGORY_ORDER.length - 1 : i;
}

const STATUS_LANES = [
  { key: 'pending', label: 'Awaiting triage' },
  { key: 'progress', label: 'Work in progress' },
  { key: 'resolved', label: 'Resolved' },
];

export function rollupByStatus(complaints) {
  const counts = { pending: 0, progress: 0, resolved: 0 };
  for (const c of complaints) counts[statusOf(c)] += 1;
  return STATUS_LANES.map((lane) => ({ ...lane, count: counts[lane.key] }));
}

/**
 * Bars are ordered by volume because the question is "what are we mostly
 * dealing with" — but each bar keeps the colour of its category, not of its
 * position, so the ranking can change without the chart re-colouring itself.
 *
 * `folded` lists the raw labels that landed in a bucket, so "Other: 12" can
 * still say what the twelve actually were.
 */
export function rollupByCategory(complaints) {
  const buckets = new Map(
    CATEGORY_ORDER.map((key) => [key, { key, label: categoryLabel(key), count: 0, folded: [] }]),
  );

  for (const c of complaints) {
    const key = categoryKey(c.category);
    const bucket = buckets.get(key);
    bucket.count += 1;

    const raw = String(c.category || '').trim();
    if (raw && raw.toLowerCase() !== key.toLowerCase() && !bucket.folded.includes(raw)) {
      bucket.folded.push(raw);
    }
  }

  return [...buckets.values()]
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count || CATEGORY_ORDER.indexOf(a.key) - CATEGORY_ORDER.indexOf(b.key));
}

const PRIORITY_BANDS = [
  { key: 'low', label: 'Low', range: [0, 40] },
  { key: 'moderate', label: 'Moderate', range: [40, 60] },
  { key: 'high', label: 'High', range: [60, 80] },
  { key: 'critical', label: 'Critical', range: [80, 101] },
];

/**
 * The mock backend scores 0–100; nothing documents what the scoring model in
 * `backend/ai/priority.py` will emit, and that file is still empty. So if every
 * score we can see is <= 1, read the column as a fraction and rescale. Getting
 * this wrong would file every case under "Low" and quietly look plausible.
 */
export function priorityScale(complaints) {
  const scores = complaints
    .map((c) => Number(c.priority_score))
    .filter((n) => Number.isFinite(n));
  if (!scores.length) return 1;
  return Math.max(...scores) <= 1 ? 100 : 1;
}

export function rollupByPriority(complaints) {
  const factor = priorityScale(complaints);
  const bands = PRIORITY_BANDS.map((b) => ({ ...b, count: 0 }));
  let unscored = 0;

  for (const c of complaints) {
    const raw = Number(c.priority_score);
    if (!Number.isFinite(raw)) {
      unscored += 1;
      continue;
    }
    const score = raw * factor;
    const band = bands.find((b) => score >= b.range[0] && score < b.range[1]) ?? bands.at(-1);
    band.count += 1;
  }

  return { bands, unscored };
}

/** Local-midnight key, so "today" means the user's today and not UTC's. */
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function filedOn(complaint) {
  const value = complaint?.timestamp || complaint?.created_at;
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Daily counts for the trailing `days` days, including the empty ones — a
 * volume chart that silently drops quiet days reads as continuous activity.
 */
export function filedPerDay(complaints, days = 14) {
  const series = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    series.push({
      key: dayKey(d),
      date: d,
      label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      count: 0,
    });
  }

  const index = new Map(series.map((s) => [s.key, s]));
  let outside = 0;

  for (const c of complaints) {
    const d = filedOn(c);
    if (!d) continue;
    const slot = index.get(dayKey(d));
    if (slot) slot.count += 1;
    else outside += 1;
  }

  return { series, outside };
}

const DAY = 86400000;

export function summarize(complaints) {
  const lanes = rollupByStatus(complaints);
  const byKey = Object.fromEntries(lanes.map((l) => [l.key, l.count]));
  const total = complaints.length;

  // Age is only meaningful for cases still open — a closed case's age is a
  // fact about the past, not a queue that needs attention.
  const openAges = complaints
    .filter((c) => statusOf(c) !== 'resolved')
    .map((c) => filedOn(c))
    .filter(Boolean)
    .map((d) => (Date.now() - d.getTime()) / DAY)
    .filter((n) => n >= 0)
    .sort((a, b) => a - b);

  const median = openAges.length
    ? openAges.length % 2
      ? openAges[(openAges.length - 1) / 2]
      : (openAges[openAges.length / 2 - 1] + openAges[openAges.length / 2]) / 2
    : null;

  return {
    total,
    pending: byKey.pending,
    progress: byKey.progress,
    resolved: byKey.resolved,
    open: byKey.pending + byKey.progress,
    resolutionRate: total ? Math.round((byKey.resolved / total) * 100) : 0,
    medianOpenDays: median === null ? null : Math.round(median * 10) / 10,
    oldestOpenDays: openAges.length ? Math.round(openAges.at(-1)) : null,
  };
}
