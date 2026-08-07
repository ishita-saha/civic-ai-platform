import { useCallback, useState } from 'react';
import { Table2 } from 'lucide-react';

/**
 * Chart primitives, built from the design tokens in index.css.
 *
 * Everything here is HTML and CSS rather than SVG: the bars need to reflow at
 * mobile widths, and a stretched viewBox would distort the rounded data-ends
 * that make a bar read as a bar. No chart library is involved.
 *
 * Colour rules these components assume (see index.css → "Chart palettes"):
 *   - categorical hues are assigned by entity, never by rank
 *   - status colours are reserved and always ship with a text label
 *   - text stays in ink tokens; the swatch beside it carries the identity
 */

/** Shared floating tooltip. Follows the pointer, never intercepts it. */
function useTooltip() {
  const [tip, setTip] = useState(null);

  const show = useCallback((event, content) => {
    setTip({ x: event.clientX, y: event.clientY, content });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  const node = tip ? (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="presentation">
      {tip.content}
    </div>
  ) : null;

  return { show, hide, node };
}

function pct(part, whole) {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

/**
 * Wrapper for a single chart: title, optional note, the plot, and a
 * disclosure-triggered data table. The table isn't a nicety — it's how the
 * numbers stay available to anyone the colours fail.
 */
export function ChartFigure({ title, note, children, table }) {
  return (
    <figure className="chart-fig">
      <figcaption>
        <h4 className="chart-title">{title}</h4>
        {note && <p className="chart-note">{note}</p>}
      </figcaption>

      {children}

      {table && (
        <details className="chart-table">
          <summary>
            <Table2 size={13} aria-hidden="true" />
            View as table
          </summary>
          {table}
        </details>
      )}
    </figure>
  );
}

/**
 * Horizontal bars with a direct label on every row.
 *
 * Direct labels are mandatory here rather than decorative: the categorical
 * palette clears the colourblind-separation floor but sits inside its warning
 * band, which is only legal alongside a second, non-colour channel. The label
 * is that channel — remove it and the chart stops being accessible.
 *
 * @param {{key: string, label: string, count: number, color: string, note?: string}[]} rows
 */
export function BarRows({ rows, total, unit = 'reports', emptyLabel = 'Nothing to chart yet.' }) {
  const tip = useTooltip();

  if (!rows.length) return <p className="chart-empty">{emptyLabel}</p>;

  // Scale to the tallest bar, not to the total — otherwise a dominant category
  // flattens everything else into an unreadable stub.
  const max = Math.max(...rows.map((r) => r.count), 1);
  const whole = total ?? rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <div className="bar-rows">
        {rows.map((row, i) => (
          <div
            className="bar-row anim-rise"
            key={row.key}
            style={{ '--i': i }}
            onMouseMove={(e) =>
              tip.show(
                e,
                <>
                  <b>{row.label}</b>
                  <span>
                    {row.count} {unit} · {pct(row.count, whole)} of {whole}
                  </span>
                  {row.note && <span className="chart-tip-note">{row.note}</span>}
                </>,
              )
            }
            onMouseLeave={tip.hide}
          >
            <span className="bar-name">{row.label}</span>
            <span className="bar-track">
              {/* A zero draws nothing. The minimum-width stub that keeps a
                  count of 1 visible would otherwise make an empty category
                  look like it had something in it. */}
              {row.count > 0 && (
                <span
                  className="bar-fill"
                  style={{ width: `${(row.count / max) * 100}%`, background: row.color }}
                />
              )}
            </span>
            <span className="bar-value tnum">{row.count}</span>
          </div>
        ))}
      </div>
      {tip.node}
    </>
  );
}

/**
 * Daily volume. Columns rather than a line because each value is a count of
 * discrete events on its own day, not a reading from a continuous quantity.
 */
export function ColumnChart({ series, unit = 'reports', label = 'Reports filed' }) {
  const tip = useTooltip();

  const max = Math.max(...series.map((s) => s.count), 1);
  const busiest = series.reduce((a, b) => (b.count > a.count ? b : a), series[0]);

  return (
    <>
      <div className="col-chart" role="img" aria-label={`${label} per day for the last ${series.length} days`}>
        {series.map((day) => (
          <div
            className="col"
            key={day.key}
            onMouseMove={(e) =>
              tip.show(
                e,
                <>
                  <b>{day.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                  <span>
                    {day.count} {day.count === 1 ? unit.replace(/s$/, '') : unit}
                  </span>
                </>,
              )
            }
            onMouseLeave={tip.hide}
          >
            <span
              className={`col-bar${day.count === 0 ? ' col-bar-zero' : ''}`}
              style={{ height: `${(day.count / max) * 100}%` }}
            />
            {/* Only the busiest day and the two ends get a tick — a label under
                every column turns into a grey smear at this width. */}
            {(day === busiest || day === series[0] || day === series.at(-1)) && (
              <span className="col-label">{day.label}</span>
            )}
          </div>
        ))}
      </div>
      {tip.node}
    </>
  );
}

/** Plain data table for a rollup, used inside ChartFigure's disclosure. */
export function RollupTable({ rows, headers = ['', 'Reports', 'Share'], total }) {
  const whole = total ?? rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            {headers.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="tnum">{r.count}</td>
              <td className="tnum">{pct(r.count, whole)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
