// 게이지: 240도 호에 대표값을 채우고, 바깥 얇은 띠에 임계값 구간 색을 표시한다.
// 최소·최대를 정하지 않으면 Grafana처럼 0~100을 쓴다.
import type { PanelOptions } from '../../api/dashboard';
import { colorCss, colorFor, formatValue, reduceValues, reducerLabel, type Point } from '../data';
import { useElementSize } from '../useElementSize';

const SWEEP = 240;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)},${s.y.toFixed(2)}A${r},${r} 0 ${large} 1 ${e.x.toFixed(2)},${e.y.toFixed(2)}`;
}

export default function GaugeViz({ points, options }: { points: Point[]; options: PanelOptions }) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const value = reduceValues(points.map((p) => p.value), options.reduce);
  const min = options.min ?? 0;
  const max = options.max ?? 100;
  const ratio = value === null ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const start = -SWEEP / 2;
  const angleOf = (v: number) => start + Math.min(1, Math.max(0, (v - min) / (max - min || 1))) * SWEEP;

  // 선 두께(0.16r)와 바깥 임계값 띠까지 포함한 그림 범위:
  // 위 1.2r, 아래(호 끝 + 둥근 끝) 0.66r, 좌우 각 1.2r
  const r = Math.max(10, Math.min((size.width - 8) / 2.4, (size.height - 8) / 1.86));
  const stroke = r * 0.16;
  const cx = size.width / 2;
  const cy = (size.height - 1.86 * r) / 2 + 1.2 * r;
  const text = formatValue(value, options);
  const fontSize = Math.max(12, Math.min(r * 0.42, (r * 1.5) / Math.max(2, text.length * 0.6)));

  // 임계값 띠: [min, 첫 단계) 기본색, 이후 단계별 색
  const bands: { from: number; to: number; color: string }[] = [];
  let prevV = min;
  let prevC = colorCss(options.color);
  for (const step of options.thresholds) {
    if (step.value <= min) {
      prevC = colorCss(step.color);
      continue;
    }
    if (step.value >= max) break;
    bands.push({ from: prevV, to: step.value, color: prevC });
    prevV = step.value;
    prevC = colorCss(step.color);
  }
  bands.push({ from: prevV, to: max, color: prevC });

  return (
    <div className="viz-gauge" ref={ref}>
      {size.width > 0 && (
        <svg width={size.width} height={size.height} role="img" aria-label={`게이지 ${text}, 범위 ${min}~${max}`}>
          {bands.map((b, k) => (
            <path key={k} d={arc(cx, cy, r + stroke * 0.95, angleOf(b.from), angleOf(b.to))} stroke={b.color} strokeWidth={Math.max(2, stroke * 0.22)} fill="none" opacity={0.85} />
          ))}
          <path d={arc(cx, cy, r, start, start + SWEEP)} stroke="var(--panel-3)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
          {ratio > 0 && (
            <path d={arc(cx, cy, r, start, start + Math.max(0.5, ratio * SWEEP))} stroke={colorFor(value, options)} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          )}
          <text x={cx} y={cy + fontSize * 0.1} textAnchor="middle" dominantBaseline="middle" className="viz-gauge-value" style={{ fontSize, fill: colorFor(value, options) }}>
            {text}
          </text>
          {r >= 40 && (
            <text x={cx} y={cy + r * 0.62} textAnchor="middle" className="viz-axis">
              {reducerLabel(options.reduce)} · {formatValue(min, options)} ~ {formatValue(max, options)}
            </text>
          )}
        </svg>
      )}
    </div>
  );
}
