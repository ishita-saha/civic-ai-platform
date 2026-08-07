import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CheckCircle2, Gauge, Inbox, RefreshCw } from 'lucide-react';
import { BarRows, ChartFigure, ColumnChart, RollupTable } from '../../components/Charts';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import {
  categorySlot,
  filedOn,
  filedPerDay,
  rollupByCategory,
  rollupByPriority,
  rollupByStatus,
  summarize,
} from '../../lib/analytics';
import { useComplaints } from '../../lib/complaintsContext';

/**
 * Reporting for the triage desk.
 *
 * Every number here is derived in the browser from `/complaints` — there is no
 * analytics endpoint, and at this volume there doesn't need to be. The rollups
 * live in lib/analytics.js so a server-side version has a signature to match.
 *
 * On colour: category bars use the validated categorical slots, keyed to the
 * category itself so re-sorting by volume never repaints them. Status bars use
 * the reserved status colours. Priority uses a single-hue sequential ramp,
 * because priority is a magnitude and not an identity. Each bar carries its own
 * text label — that is what makes the palette accessible, not a nicety.
 */

const STATUS_COLOR = {
  pending: 'var(--c-warn)',
  progress: 'var(--c-info)',
  resolved: 'var(--c-ok)',
};

const WINDOWS = [
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

export default function Analytics() {
  const { complaints, loading, refresh } = useComplaints();
  const [windowDays, setWindowDays] = useState(14);

  const stats = useMemo(() => summarize(complaints), [complaints]);

  const categories = useMemo(
    () =>
      rollupByCategory(complaints).map((row) => ({
        ...row,
        color: `var(--c-cat-${categorySlot(row.key) + 1})`,
        note: row.folded.length ? `Includes: ${row.folded.join(', ')}` : undefined,
      })),
    [complaints],
  );

  const statuses = useMemo(
    () => rollupByStatus(complaints).map((row) => ({ ...row, color: STATUS_COLOR[row.key] })),
    [complaints],
  );

  const priority = useMemo(() => rollupByPriority(complaints), [complaints]);

  const priorityRows = useMemo(
    () =>
      priority.bands.map((band, i) => ({
        ...band,
        color: `var(--c-seq-${i + 1})`,
      })),
    [priority],
  );

  const timeline = useMemo(() => filedPerDay(complaints, windowDays), [complaints, windowDays]);

  // A volume chart that quietly drops records reads as complete when it isn't.
  // Count what the window and the missing-date problem left out, and say so.
  const undated = useMemo(() => complaints.filter((c) => !filedOn(c)).length, [complaints]);

  if (!loading && complaints.length === 0) {
    return (
      <div className="stack page-enter" style={{ '--gap': '16px', maxWidth: 620, margin: '0 auto' }}>
        <Link className="backlink" to="/admin">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to the dashboard
        </Link>
        <div className="card">
          <EmptyState icon={Inbox} title="Nothing to report on yet">
            Charts appear once the first case comes in. Until then there is no shape to describe.
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="stack page-enter" style={{ '--gap': '22px' }}>
      <Link className="backlink" to="/admin">
        <ArrowLeft size={14} aria-hidden="true" />
        Back to the dashboard
      </Link>

      <div className="spread">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="page-lede">
            What the queue is made of, how fast it clears, and what is arriving. Computed from the
            live case list each time this page loads.
          </p>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => refresh({ announce: true })}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : undefined} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="stat-grid">
        <StatCard
          index={0}
          icon={Inbox}
          label="Open cases"
          value={stats.open}
          tone="var(--c-warn)"
          toneSoft="var(--c-warn-soft)"
        />
        <StatCard
          index={1}
          icon={CheckCircle2}
          label="Resolved"
          value={stats.resolved}
          tone="var(--c-ok)"
          toneSoft="var(--c-ok-soft)"
          badge={<span className="chip tnum">{stats.resolutionRate}%</span>}
        />
        <StatCard
          index={2}
          icon={CalendarClock}
          label="Median days open"
          // Rounded to whole days for the counter, with the exact figure in the
          // badge — the animated count-up can only carry an integer.
          value={stats.medianOpenDays === null ? 0 : Math.round(stats.medianOpenDays)}
          tone="var(--c-info)"
          toneSoft="var(--c-info-soft)"
          badge={
            stats.medianOpenDays === null ? (
              <span className="chip">no dates</span>
            ) : (
              <span className="chip tnum">{stats.medianOpenDays}d</span>
            )
          }
        />
        <StatCard
          index={3}
          icon={Gauge}
          label="Oldest open case"
          value={stats.oldestOpenDays ?? 0}
          tone="var(--c-brand)"
          toneSoft="var(--c-brand-soft)"
          badge={<span className="chip">days</span>}
        />
      </div>

      <div className="chart-grid">
        <ChartFigure
          title="Reports by category"
          note="Ordered by volume; each category keeps its own colour, so the ranking can change without the chart re-colouring itself."
          table={<RollupTable rows={categories} headers={['Category', 'Reports', 'Share']} />}
        >
          <BarRows rows={categories} total={stats.total} />
        </ChartFigure>

        <ChartFigure
          title="Case load by status"
          note="Where the queue currently sits. Resolved cases stay in the count so the share is out of everything ever filed."
          table={<RollupTable rows={statuses} headers={['Status', 'Cases', 'Share']} />}
        >
          <BarRows rows={statuses} total={stats.total} unit="cases" />
        </ChartFigure>

        <ChartFigure
          title="Priority distribution"
          note={
            priority.unscored
              ? `Darker means higher priority. ${priority.unscored} ${
                  priority.unscored === 1 ? 'case has' : 'cases have'
                } no score and are left out of this chart.`
              : 'Darker means higher priority — one hue, four steps, because priority is a magnitude rather than four unrelated things.'
          }
          table={<RollupTable rows={priorityRows} headers={['Band', 'Cases', 'Share']} />}
        >
          <BarRows
            rows={priorityRows}
            unit="cases"
            emptyLabel="No case carries a priority score yet."
          />
        </ChartFigure>

        <ChartFigure
          title="Reports filed per day"
          note={[
            timeline.outside
              ? `${timeline.outside} older ${timeline.outside === 1 ? 'report falls' : 'reports fall'} outside this window.`
              : null,
            undated
              ? `${undated} ${undated === 1 ? 'report has' : 'reports have'} no filing date and cannot be plotted.`
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="row" style={{ '--gap': '6px', marginBottom: 4 }}>
            <div className="segmented" role="group" aria-label="Time range">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  type="button"
                  aria-pressed={windowDays === w.days}
                  onClick={() => setWindowDays(w.days)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <ColumnChart series={timeline.series} />
        </ChartFigure>
      </div>
    </div>
  );
}
