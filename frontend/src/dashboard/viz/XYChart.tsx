// 시계열(선)·막대 공용 차트. Grafana처럼 옅은 격자, 왼쪽 값 축, 아래 라벨 축,
// 마우스를 올리면 세로 보조선과 값 툴팁을 보여 준다.
import { useId, useState, type PointerEvent } from 'react';
import type { PanelOptions } from '../../api/dashboard';
import { colorCss, colorFor, formatValue, valueRange, type Point } from '../data';
import { useElementSize } from '../useElementSize';

interface Props {
  points: Point[];
  options: PanelOptions;
  kind: 'line' | 'bar';
}

const PAD_TOP = 10;
const PAD_RIGHT = 12;
const AXIS_BOTTOM = 22;
const CHAR_PX = 6.6; // 축 글자(0.7rem 고정폭) 대략 폭

export default function XYChart({ points, options, kind }: Props) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  const values = points.map((p) => p.value);
  const range = valueRange(values, options, kind === 'bar');
  const tickLabels = range.ticks.map((t) => formatValue(t, { ...options, decimals: options.decimals ?? null }));
  const showAxes = size.height >= 90 && size.width >= 140;
  const padLeft = showAxes ? Math.ceil(Math.max(...tickLabels.map((s) => s.length)) * CHAR_PX) + 12 : 6;
  const padBottom = showAxes ? AXIS_BOTTOM : 6;
  const plotW = Math.max(1, size.width - padLeft - PAD_RIGHT);
  const plotH = Math.max(1, size.height - PAD_TOP - padBottom);
  const n = points.length;
  const span = range.max - range.min || 1;
  const yOf = (v: number) => PAD_TOP + plotH - ((Math.min(Math.max(v, range.min), range.max) - range.min) / span) * plotH;

  // 선: 점 사이 균등 간격, 막대: 칸 가운데
  const band = kind === 'bar' ? plotW / Math.max(1, n) : 0;
  const xOf = (i: number) =>
    kind === 'bar' ? padLeft + band * (i + 0.5) : padLeft + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // 아래 라벨: 겹치지 않게 일정 간격으로만 표시
  const maxLabelChars = Math.max(1, ...points.map((p) => p.label.length));
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / (maxLabelChars * CHAR_PX + 14)))));

  const base = colorCss(options.color);

  function onMove(e: PointerEvent<SVGRectElement>) {
    if (n === 0) return;
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - box.left;
    const i = kind === 'bar' ? Math.floor((x - padLeft) / band) : Math.round(((x - padLeft) / plotW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  // 선 경로: 계산 불가(null) 점에서 끊는다.
  const segments: { x: number; y: number }[][] = [];
  if (kind === 'line') {
    let cur: { x: number; y: number }[] = [];
    points.forEach((p, i) => {
      if (p.value === null) {
        if (cur.length) segments.push(cur);
        cur = [];
      } else cur.push({ x: xOf(i), y: yOf(p.value) });
    });
    if (cur.length) segments.push(cur);
  }
  const baseY = yOf(Math.max(range.min, Math.min(0, range.max)));
  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="viz-xy" ref={ref}>
      {size.width > 0 && (
        <svg width={size.width} height={size.height} role="img" aria-label={`${kind === 'line' ? '시계열' : '막대'} 그래프, 점 ${n}개`}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={base} stopOpacity="0.28" />
              <stop offset="100%" stopColor={base} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {showAxes &&
            range.ticks.map((t, k) => (
              <g key={t}>
                <line className="viz-grid" x1={padLeft} x2={padLeft + plotW} y1={yOf(t)} y2={yOf(t)} />
                <text className="viz-axis" x={padLeft - 8} y={yOf(t)} textAnchor="end" dominantBaseline="middle">
                  {tickLabels[k]}
                </text>
              </g>
            ))}
          {showAxes &&
            points.map((p, i) =>
              i % labelEvery === 0 ? (
                <text key={i} className="viz-axis" x={xOf(i)} y={PAD_TOP + plotH + 15} textAnchor="middle">
                  {p.label}
                </text>
              ) : null,
            )}

          {options.thresholds.map((s, k) =>
            s.value >= range.min && s.value <= range.max ? (
              <line key={k} className="viz-threshold" x1={padLeft} x2={padLeft + plotW} y1={yOf(s.value)} y2={yOf(s.value)} stroke={colorCss(s.color)} />
            ) : null,
          )}

          {kind === 'line' &&
            segments.map((seg, k) => {
              const d = seg.map((pt, j) => `${j ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join('');
              const area = `${d}L${seg[seg.length - 1].x.toFixed(1)},${baseY.toFixed(1)}L${seg[0].x.toFixed(1)},${baseY.toFixed(1)}Z`;
              return (
                <g key={k}>
                  <path d={area} fill={`url(#${gradId})`} />
                  <path d={d} fill="none" stroke={base} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {n <= 40 && seg.map((pt, j) => <circle key={j} cx={pt.x} cy={pt.y} r={2.5} fill={base} />)}
                </g>
              );
            })}

          {kind === 'bar' &&
            points.map((p, i) => {
              if (p.value === null) return null;
              const w = Math.max(1, band * 0.7);
              const y = yOf(p.value);
              return (
                <rect
                  key={i}
                  x={xOf(i) - w / 2}
                  y={Math.min(y, baseY)}
                  width={w}
                  height={Math.max(1, Math.abs(baseY - y))}
                  rx={2}
                  fill={colorFor(p.value, options)}
                  opacity={hover === null || hover === i ? 0.9 : 0.45}
                />
              );
            })}

          {hp && hp.value !== null && kind === 'line' && (
            <g>
              <line className="viz-cross" x1={xOf(hover!)} x2={xOf(hover!)} y1={PAD_TOP} y2={PAD_TOP + plotH} />
              <circle cx={xOf(hover!)} cy={yOf(hp.value)} r={4} fill={base} stroke="var(--panel)" strokeWidth={2} />
            </g>
          )}

          <rect
            x={padLeft}
            y={PAD_TOP}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hp && (
        <div
          className="viz-tooltip"
          style={{
            left: Math.min(Math.max(xOf(hover!) + 12, 4), Math.max(4, size.width - 150)),
            top: PAD_TOP,
          }}
        >
          <div className="tt-label">{hp.label}</div>
          <div className="tt-row">
            <span className="tt-swatch" style={{ background: hp.value !== null ? colorFor(hp.value, options) : base }} />
            <b>{formatValue(hp.value, options)}</b>
          </div>
        </div>
      )}
    </div>
  );
}
