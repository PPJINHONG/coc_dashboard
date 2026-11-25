import type { ReportContent } from "../../shared/featureReport";

type Trends = NonNullable<ReportContent["trends"]>;
const inks = ["#274e80", "#578cd3", "#515b6a"];
const format = (n: number) => n.toLocaleString("ko-KR");

export default function ResourceChart({ trend, labels, title, unit }: {
  trend: Trends; labels: string[]; title: string; unit: string;
}) {
  const { months } = trend;
  const lines = trend.series.filter((s) => labels.includes(s.label));
  const peak = Math.max(1, ...lines.flatMap((s) => s.values.map((v) => v ?? 0)));
  const step = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.max(2, Math.ceil(peak / step) * step);
  const left = 48, right = 486, top = 12, bottom = 78;
  const x = (i: number) => left + (i + 0.5) * (right - left) / months.length;
  const y = (v: number) => bottom - (bottom - top) * v / ceiling;
  return <figure className="resource-chart">
    <figcaption><b>{title}</b><span>{unit}</span></figcaption>
    <div className="chart-key">{lines.map((s, index) =>
      <span key={s.label}><i style={{ background: inks[index] }} />{s.label}</span>)}</div>
    <svg viewBox="0 0 500 99" role="img" aria-label={title + " · " + months[0] + " ~ " + months.at(-1)}>
      {[0, ceiling / 2, ceiling].map((v) => <g key={v}>
        <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#d0d5de" />
        <text x={left-6} y={y(v)+4} textAnchor="end">{format(v)}</text></g>)}
      {lines.map((s, k) => <g key={s.label}>
        {s.values.map((v, i) => {
          if (v === null) return null;
          const prev = s.values[i-1];
          return <g key={months[i]}><title>{months[i]} · {s.label} {format(v)}{unit}</title>
            {prev != null && <line x1={x(i-1)} x2={x(i)} y1={y(prev)} y2={y(v)} stroke={inks[k]} strokeWidth="2.4" />}
            <circle cx={x(i)} cy={y(v)} r="3" fill={inks[k]} stroke="white" />
          </g>;
        })}
      </g>)}
      {months.map((month,i) => <text key={month} x={x(i)} y={bottom+16} textAnchor="middle">
        {Number(month.slice(-2))}월
      </text>)}
    </svg>
  </figure>;
}
