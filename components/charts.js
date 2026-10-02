'use client';
import { useEffect, useRef, useState } from 'react';
import { niceTicks } from '../lib/ticks.js';

const fmt = (n) => (n || 0).toLocaleString('en-IN');
const dayLabel = (d) => {
  const [, m, dd] = d.split('-');
  return `${+dd} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]}`;
};

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Top-rounded rect (4px data-end, square at the baseline). */
function capPath(x, y, w, h, r = 4) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.key}><i className="swatch" style={{ background: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}

function Tip({ tip }) {
  if (!tip) return null;
  return (
    <div className="tip" style={{ left: tip.x, top: tip.y }} role="status">
      <div className="t">{tip.title}</div>
      {tip.rows.map((r) => (
        <div className="row" key={r.label}>
          <span className="k"><i className="key" style={{ background: r.color }} />{r.label}</span>
          <b>{fmt(r.value)}</b>
        </div>
      ))}
      {tip.total !== undefined ? <div className="row"><span className="k">Total</span><b>{fmt(tip.total)}</b></div> : null}
    </div>
  );
}

/** Stacked columns per day. series: [{key,label,color}], days: [{date, values:{key:n}}] */
export function StackedColumns({ days, series, height = 220, unit = '' }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const m = { l: 34, r: 8, t: 18, b: 26 };
  const iw = width - m.l - m.r, ih = height - m.t - m.b;
  const totals = days.map((d) => series.reduce((s, k) => s + (d.values[k.key] || 0), 0));
  const { max, ticks } = niceTicks(Math.max(1, ...totals));
  const band = iw / Math.max(1, days.length), bw = Math.max(3, Math.min(24, band * 0.62));
  const y = (v) => m.t + ih - (v / max) * ih;
  const every = Math.ceil(days.length / Math.max(2, Math.floor(iw / 56)));
  const lastIdx = days.length - 1;

  const show = (i, evt) => {
    const d = days[i];
    const rows = series.filter((s) => d.values[s.key]).map((s) => ({ label: s.label, color: s.color, value: d.values[s.key] }));
    const cx = m.l + band * i + band / 2;
    setTip({ x: cx + 190 > width ? Math.max(0, cx - band / 2 - 186) : cx + band / 2 + 6, y: 4, title: dayLabel(d.date) + (unit ? ' · ' + unit : ''),
      rows: rows.length ? rows : [{ label: 'None', color: 'transparent', value: 0 }], total: totals[i] });
  };

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={`${unit || 'Values'} per day, stacked by brand`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth="1" />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = m.l + band * i + (band - bw) / 2;
          let base = 0;
          const segs = series.filter((s) => d.values[s.key] > 0);
          return (
            <g key={d.date}>
              {segs.map((s, j) => {
                const v = d.values[s.key], top = y(base + v), bottom = y(base) - (j > 0 ? 2 : 0);
                base += v;
                const h = Math.max(0, bottom - top);
                return j === segs.length - 1
                  ? <path key={s.key} d={capPath(x, top, bw, h)} fill={s.color} />
                  : <rect key={s.key} x={x} y={top} width={bw} height={h} fill={s.color} />;
              })}
              {(i % every === 0 || i === lastIdx) && (lastIdx - i >= every / 2 || i === lastIdx) ? (
                <text x={x + bw / 2} y={height - 8} textAnchor="middle">{dayLabel(d.date)}</text>
              ) : null}
            </g>
          );
        })}
        {totals[lastIdx] > 0 ? (
          <text x={m.l + band * lastIdx + band / 2} y={y(totals[lastIdx]) - 5} textAnchor="middle" style={{ fill: 'var(--text-secondary)', fontWeight: 600 }}>
            {fmt(totals[lastIdx])}
          </text>
        ) : null}
        {days.map((d, i) => (
          <rect key={'h' + d.date} className="hit" x={m.l + band * i} y={m.t} width={band} height={ih} tabIndex={0}
            aria-label={`${dayLabel(d.date)}: ${totals[i]} total`}
            onMouseMove={(e) => show(i, e)} onFocus={(e) => show(i, e)} onBlur={() => setTip(null)} />
        ))}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/** Horizontal bars, one per row. rows: [{key,label,value,color,note}] */
export function HBars({ rows, valueLabel = '' }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const lw = width < 520 ? 44 : Math.min(170, width * 0.36), vw = 64, bh = 16, gap = 14;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const iw = Math.max(40, width - lw - vw);
  const height = rows.length * (bh + gap);
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={valueLabel + ' by brand'}>
        <line x1={lw} x2={lw} y1={0} y2={height - gap} stroke="var(--axis)" />
        {rows.map((r, i) => {
          const yy = i * (bh + gap), w = (r.value / max) * iw;
          return (
            <g key={r.key}>
              <text x={lw - 8} y={yy + bh / 2 + 4} textAnchor="end" style={{ fill: 'var(--text-secondary)' }}>{width < 520 ? r.key : r.label}</text>
              {w > 0 ? <path d={`M${lw},${yy}H${lw + w - Math.min(4, w)}Q${lw + w},${yy} ${lw + w},${yy + Math.min(4, w)}V${yy + bh - Math.min(4, w)}Q${lw + w},${yy + bh} ${lw + w - Math.min(4, w)},${yy + bh}H${lw}Z`} fill={r.color} /> : null}
              <text x={lw + w + 6} y={yy + bh / 2 + 4} style={{ fill: 'var(--text-primary)' }}>{fmt(r.value)}{r.note ? `  ${r.note}` : ''}</text>
              <rect className="hit" x={0} y={yy - gap / 2} width={width} height={bh + gap} tabIndex={0} aria-label={`${r.label}: ${r.value}`}
                onMouseMove={() => setTip({ x: Math.min(lw + w + 10, width - 170), y: yy + bh + 4, title: r.label, rows: [{ label: valueLabel, color: r.color, value: r.value }] })}
                onFocus={() => setTip({ x: Math.min(lw + w + 10, width - 170), y: yy + bh + 4, title: r.label, rows: [{ label: valueLabel, color: r.color, value: r.value }] })}
                onBlur={() => setTip(null)} />
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/** One stacked horizontal bar per brand across ordered stages. stages: [{key,label,color}], rows: [{key,label,values:{stage:n}}] */
export function StageBars({ rows, stages }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const lw = width < 520 ? 44 : Math.min(170, width * 0.36), bh = 16, gap = 14, rw = 52;
  const max = Math.max(1, ...rows.map((r) => stages.reduce((s, st) => s + (r.values[st.key] || 0), 0)));
  const iw = Math.max(40, width - lw - rw);
  const height = rows.length * (bh + gap);
  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label="Lead pipeline by brand">
        <line x1={lw} x2={lw} y1={0} y2={height - gap} stroke="var(--axis)" />
        {rows.map((r, i) => {
          const yy = i * (bh + gap);
          const total = stages.reduce((s, st) => s + (r.values[st.key] || 0), 0);
          let x = lw;
          const segs = stages.filter((st) => r.values[st.key] > 0);
          const open = () => setTip({ x: Math.min(lw + 8, width - 170), y: yy + bh + 4, title: r.label,
            rows: stages.map((st) => ({ label: st.label, color: st.color, value: r.values[st.key] || 0 })), total });
          return (
            <g key={r.key}>
              <text x={lw - 8} y={yy + bh / 2 + 4} textAnchor="end" style={{ fill: 'var(--text-secondary)' }}>{width < 520 ? r.key : r.label}</text>
              {segs.map((st, j) => {
                const w = Math.max(0, ((r.values[st.key] || 0) / max) * iw - (j < segs.length - 1 ? 2 : 0));
                const el = j === segs.length - 1 && w > 4
                  ? <path key={st.key} d={`M${x},${yy}H${x + w - 4}Q${x + w},${yy} ${x + w},${yy + 4}V${yy + bh - 4}Q${x + w},${yy + bh} ${x + w - 4},${yy + bh}H${x}Z`} fill={st.color} />
                  : <rect key={st.key} x={x} y={yy} width={w} height={bh} fill={st.color} />;
                x += w + 2;
                return el;
              })}
              <text x={width - 4} y={yy + bh / 2 + 4} textAnchor="end" style={{ fill: 'var(--text-primary)' }}>{fmt(total)}</text>
              <rect className="hit" x={0} y={yy - gap / 2} width={width} height={bh + gap} tabIndex={0} aria-label={`${r.label}: ${total} leads`}
                onMouseMove={open} onFocus={open} onBlur={() => setTip(null)} />
            </g>
          );
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/** Arc path for a donut slice from angle a0 to a1 (radians, 0 = 12 o'clock). */
function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

/** Donut: parts of one whole. slices: [{key,label,color,value}]. Legend lists every part with count and %. */
export function Donut({ slices, centerLabel = 'total', size = 168 }) {
  const [hover, setHover] = useState(null);
  const total = slices.reduce((s, x) => s + (x.value || 0), 0);
  const cx = size / 2, cy = size / 2, r1 = size / 2 - 2, r0 = r1 * 0.62, gap = 0.012;
  let a = 0;
  const shown = slices.filter((x) => x.value > 0);
  const pctOf = (v) => (total ? Math.round((v / total) * 100) : 0);
  const pctLabel = (v) => (v > 0 && pctOf(v) === 0 ? '<1%' : `${pctOf(v)}%`);
  const active = hover ? slices.find((x) => x.key === hover) : null;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img"
        aria-label={slices.map((x) => `${x.label}: ${x.value} (${pctOf(x.value)}%)`).join('; ')}>
        {total === 0 ? <circle cx={cx} cy={cy} r={(r0 + r1) / 2} fill="none" stroke="var(--grid)" strokeWidth={r1 - r0} />
          : shown.length === 1 ? <circle cx={cx} cy={cy} r={(r0 + r1) / 2} fill="none" stroke={shown[0].color} strokeWidth={r1 - r0} />
          : shown.map((x) => {
            const a0 = a, a1 = a + (x.value / total) * Math.PI * 2; a = a1;
            return <path key={x.key} d={arc(cx, cy, r0, r1, a0 + gap, a1 - gap)} fill={x.color}
              opacity={hover && hover !== x.key ? 0.35 : 1} onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)} />;
          })}
        <text x={cx} y={cy + 2} textAnchor="middle" className="donut-num">{fmt(active ? active.value : total)}</text>
        <text x={cx} y={cy + 20} textAnchor="middle" className="donut-lbl">{active ? pctLabel(active.value) : centerLabel}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map((x) => (
          <li key={x.key} onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)} className={hover === x.key ? 'on' : ''}>
            <i className="swatch" style={{ background: x.color }} />
            <span className="lbl">{x.label}</span>
            <b className="num">{fmt(x.value)}</b>
            <span className="pct num">{pctLabel(x.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Card with a chart and its table-view twin (the table is always one click away).
 *  summary: one plain sentence with the main point, shown above the chart and the table. */
export function ChartCard({ title, sub, summary, legend, chart, table }) {
  const [on, setOn] = useState(false);
  return (
    <section className="card">
      <div className="card-head">
        <div><h2>{title}</h2>{sub ? <p className="sub">{sub}</p> : null}</div>
        {table ? <button className="linkbtn" onClick={() => setOn(!on)} aria-pressed={on}>{on ? 'Show chart' : 'Show table'}</button> : null}
      </div>
      {summary ? <p className="takeaway">{summary}</p> : null}
      {on ? <div className="tablewrap">{table}</div> : <>{legend}{chart}</>}
    </section>
  );
}

export { fmt, dayLabel };
