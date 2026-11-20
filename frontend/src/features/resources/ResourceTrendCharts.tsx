import { useState } from "react";
import type { DataRow } from "../../shared/api/operations";
import { amountText, difference, formatCount, measure, signed, type Quantity, type locations } from "./resourceMetrics";

export type Period = { month: string; rows: DataRow[]; sites: ReturnType<typeof locations> };
const colors = ["#636ba6", "#327dac", "#2a856f", "#92673b", "#596e84"];

export default function ResourceTrendCharts({ periods, metric, areas, label, unit }: {
  periods: Period[]; metric: Quantity; areas: string[]; label: string; unit: string;
}) {
  const [month, setMonth] = useState("");
  const found = periods.findIndex((p) => p.month === month);
  const index = found === -1 ? periods.length - 1 : found;
  const series = areas.map((area, i) => ({
    area, color: colors[i % colors.length],
    values: periods.map(({sites}) => measure(sites.filter((site) => site.area === area).flatMap((site) => site.rows), metric)),
  }));
  const totals = periods.map((p) => measure(p.rows, metric));
  const changes = totals.map((total, i) => i ? difference(total, totals[i - 1]) : null);
  const start = 68, end = 617, step = (end - start) / periods.length;
  const x = (i: number) => start + (i + 0.5) * step;
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((a) => a.value ?? 0)));
  const ceiling = Math.ceil(max / 4) * 4;
  const y = (v: number) => 188 - 162 * v / ceiling;
  const monthLabels = periods.map((p, i) => <text key={p.month} x={x(i)} y={212} textAnchor="middle">{p.month.slice(2).replace("-", ".")}</text>);
  const targets = periods.map((p, i) => <rect key={p.month} className="resource-month-hit"
    role="button" tabIndex={0} aria-label={p.month + " 수치 보기"} aria-pressed={i === index}
    x={start + i * step} y={10} width={step} height={208} onClick={() => setMonth(p.month)}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMonth(p.month); } }} />);
  const positive = Math.max(0, ...changes.map((v) => v ?? 0));
  const negative = Math.min(0, ...changes.map((v) => v ?? 0));
  const deltaY = (v: number) => 174 - (v - negative) / (positive - negative || 1) * 132;
  const change = changes[index];
  return <div className="resource-chart-stack">
    <section className="resource-visual-panel resource-trend-chart">
      <header className="resource-visual-header"><h2>권역별 월간 추이</h2><span>{label} · {unit}</span></header>
      <div className="resource-chart-legend">{series.map((s) => <span key={s.area}><i style={{background:s.color}} />{s.area}</span>)}</div>
      <svg viewBox="0 0 640 224" role="group" aria-label="권역별 월 선택">
        {[0,1,2,3,4].map((i) => <g key={i}><line x1={start} x2={end} y1={y(i*ceiling/4)} y2={y(i*ceiling/4)} stroke="#d5e0ea" strokeDasharray="3 4"/>
          <text x={start-8} y={y(i*ceiling/4)+4} textAnchor="end">{formatCount(i*ceiling/4)}</text></g>)}
        <line x1={x(index)} x2={x(index)} y1="16" y2="190" stroke="#758aa0" strokeDasharray="3 3" />
        {monthLabels}
        {series.map((s) => {
          const points = s.values.map((a) => a.incomplete ? null : a.value);
          return <g key={s.area}><path d={points.map((v,i) => v===null ? "" : `${i && points[i-1] !== null ? "L":"M"}${x(i)},${y(v)}`).join(" ")}
            fill="none" stroke={s.color} strokeWidth="2.7" />
            {points.map((v,i) => v !== null && <circle key={i} cx={x(i)} cy={y(v)} r={index===i?5:3} fill="white" stroke={s.color} strokeWidth="2" />)}</g>;
        })}{targets}
      </svg>
      <div className="resource-chart-detail" aria-live="polite"><strong>{periods[index].month}</strong>{series.map((s) => {
        const d=index ? difference(s.values[index],s.values[index-1]) : null;
        return <span key={s.area}>{s.area} <b>{amountText(s.values[index])}{s.values[index].value !== null && unit}</b>{d !== null && <small>전월 {signed(d)}{unit}</small>}</span>;
      })}</div>
    </section>
    <section className="resource-visual-panel resource-trend-chart">
      <header className="resource-visual-header"><h2>전체 권역 합산 증감</h2><span>{label} · 전월 대비</span></header>
      <svg viewBox="0 0 640 224" role="group" aria-label="전체 권역 월별 증감 선택">
        <line x1={start} x2={end} y1={deltaY(0)} y2={deltaY(0)} stroke="#899eb1"/>
        <text x={start-8} y={deltaY(0)+4} textAnchor="end">0</text>
        {changes.map((v,i) => <g key={i}>
          {v!==null && <rect x={x(i)-step*.32} y={Math.min(deltaY(v),deltaY(0))} width={step*.64} height={Math.max(2,Math.abs(deltaY(v)-deltaY(0)))} rx="3"
            fill={v < 0 ? "#b87953" : i === index ? "#275da0" : "#5b95aa"} />}
          <text x={x(i)} y={v===null ? deltaY(0)-7 : deltaY(v)+(v<0?14:-7)} textAnchor="middle">{v===null ? (i===0?"기준":"—") : signed(v)}</text>
        </g>)}{monthLabels}{targets}
      </svg>
      <div className="resource-chart-detail" aria-live="polite"><strong>{periods[index].month}</strong><span>권역 합계 <b>{amountText(totals[index])}{totals[index].value !== null && unit}</b></span>
        <span>전월 대비 <b>{change===null ? "—" : signed(change)+unit}</b></span></div>
    </section>
  </div>;
}
