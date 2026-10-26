// 숫자(Stat): 대표값 하나를 크게, 뒤쪽에 옅은 추세 영역을 함께 그린다.
import { useId } from 'react';
import type { PanelOptions } from '../../api/dashboard';
import { colorFor, formatValue, reduceValues, reducerLabel, type Point } from '../data';
import { useElementSize } from '../useElementSize';

export default function StatViz({ points, options }: { points: Point[]; options: PanelOptions }) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const gradId = useId();
  const value = reduceValues(points.map((p) => p.value), options.reduce);
  const text = formatValue(value, options);
  const color = colorFor(value, options);

  // 글자 크기: 패널 높이와 너비(글자 수) 중 작은 쪽에 맞춘다.
  const fontSize = Math.max(14, Math.min(96, size.height * 0.4, (size.width - 16) / Math.max(2, text.length * 0.62)));

  const nums = points.map((p) => p.value);
  const valid = nums.filter((v): v is number => v !== null);
  let spark: string | null = null;
  if (valid.length >= 2 && size.height >= 70 && size.width > 0) {
    const lo = Math.min(...valid);
    const hi = Math.max(...valid);
    const h = size.height * 0.45;
    const top = size.height - h;
    const xs = (i: number) => (i / (nums.length - 1)) * size.width;
    const ys = (v: number) => top + h - ((v - lo) / (hi - lo || 1)) * h * 0.9;
    const pts = nums.map((v, i) => (v === null ? null : `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`)).filter(Boolean);
    spark = `M${pts.join('L')}L${size.width},${size.height}L0,${size.height}Z`;
  }

  return (
    <div className="viz-stat" ref={ref}>
      {spark && (
        <svg className="viz-stat-spark" width={size.width} height={size.height} aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <path d={spark} fill={`url(#${gradId})`} stroke={color} strokeOpacity="0.5" strokeWidth={1.5} />
        </svg>
      )}
      <div className="viz-stat-value" style={{ color, fontSize }}>
        {text}
      </div>
      {size.height >= 80 && <div className="viz-stat-caption">{reducerLabel(options.reduce)}</div>}
    </div>
  );
}
