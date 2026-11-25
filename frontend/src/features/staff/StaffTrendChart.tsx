import { useState } from "react";
import Panel from "../../shared/components/Panel";
import type { TrendMonth } from "./api";

type Movement = "hires" | "resignations" | "deployments" | "assignment_ends";
type Series = { key: Movement; label: string; tone: string };
const formatMonth = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
const stepSize = (max: number) => Math.max(1, Math.ceil(max / 4));

export function StaffMovementChart({ months, title, series }: {
  months: TrendMonth[];
  title: string;
  series: readonly Series[];
}) {
  const [selected, setSelected] = useState("");
  const active = months.find((row) => row.month === selected) ?? months.at(-1);
  const step = stepSize(Math.max(...months.flatMap((row) => series.map(({key}) => row[key]))));
  const max = step * 4;
  return (
    <Panel title={title} action={<div className="staff-trend-legend">
      {series.map(({key, label, tone}) => <span key={key}><i className={tone} />{label}</span>)}
    </div>}>
      <div className="staff-trend-scroll">
        <div className="staff-trend-plot">
          <div className="staff-trend-scale" aria-hidden="true">
            {[4, 3, 2, 1, 0].map((tick) => <span key={tick}>{tick * step}</span>)}
          </div>
          <div className="staff-trend-months">
            {months.map((row, index) => (
              <button type="button" key={row.month} aria-pressed={active === row}
                aria-label={`${formatMonth(row.month)} · ${series.map(({key, label}) => `${label} ${row[key]}명`).join(" · ")}`}
                onClick={() => setSelected(row.month)} onFocus={() => setSelected(row.month)}>
                <span className="staff-trend-bars" aria-hidden="true">
                  {series.map(({key, tone}) => <i key={key} className={tone} style={{ height: `${row[key] * 100 / max}%` }} />)}
                </span>
                <span className="staff-trend-month-label">{index === 0 || row.month.endsWith("-01") ? row.month.slice(2).replace("-", ".") : `${Number(row.month.slice(5))}월`}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {active && <div className="staff-trend-reading" aria-live="polite">
        <strong>{formatMonth(active.month)}</strong>
        {series.map(({key, label, tone}) => <span key={key}><i className={tone} />{label} <b>{active[key]}명</b></span>)}
      </div>}
    </Panel>
  );
}

export function StaffHeadcountChart({ months }: { months: TrendMonth[] }) {
  const max = 4 * stepSize(Math.max(...months.map((row) => row.headcount)));
  const points = months.map((row, index) => ({ ...row, x: 72 + index * 72, y: 167 - row.headcount * 144 / max }));
  const plotted = points.filter((row) => !row.future);
  return <Panel title="월별 운영 인원" subtitle="월말 기준 · 이번 달은 오늘 기준">
    <div className="staff-trend-scroll staff-headcount-chart">
      <svg viewBox="0 0 936 210" role="img" aria-label={plotted.map((row) => `${formatMonth(row.month)} ${row.headcount}명${row.recorded ? " (월별 기록)" : ""}`).join(", ") || "집계된 월 없음"}>
        {[0, 1, 2, 3, 4].map((tick) => <g key={tick}>
          <text x="35" y={171 - tick * 36} textAnchor="end">{max * tick / 4}</text>
          <line x1="48" x2="900" y1={167 - tick * 36} y2={167 - tick * 36} />
        </g>)}
        <polyline points={plotted.map(({x, y}) => `${x},${y}`).join(" ")} />
        {points.map((row) => <g key={row.month}>
          {!row.future && <>
            <circle cx={row.x} cy={row.y} r="4" className={row.recorded ? "staff-recorded-point" : undefined} />
            <text x={row.x} y={row.y - 11} textAnchor="middle">{row.headcount}</text>
          </>}
          <text x={row.x} y="194" textAnchor="middle">{row.month.slice(2).replace("-", ".")}</text>
        </g>)}
      </svg>
    </div>
    {plotted.some((row) => row.recorded) && <p className="staff-trend-footnote">빈 원은 기존 월별 운영 인원 기록입니다.</p>}
  </Panel>;
}
