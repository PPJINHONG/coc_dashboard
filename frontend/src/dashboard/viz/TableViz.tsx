// 표: 라벨·원본 값·결과 값(변환 수식 적용)을 나란히 보여 준다. 결과 값은 임계값 색으로 표시.
import type { PanelOptions } from '../../api/dashboard';
import { colorFor, formatValue, type Point } from '../data';

export default function TableViz({ points, options, hasFormula }: { points: Point[]; options: PanelOptions; hasFormula: boolean }) {
  return (
    <div className="viz-table-wrap" tabIndex={0} aria-label="패널 표 (스크롤 가능)">
      <table className="viz-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">라벨</th>
            {hasFormula && <th scope="col" className="num">원본</th>}
            <th scope="col" className="num">{hasFormula ? '결과' : '값'}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td className="muted idx">{i + 1}</td>
              <td className="label">{p.label}</td>
              {hasFormula && <td className="num muted">{formatValue(p.raw, { ...options, unit: 'none', decimals: null })}</td>}
              <td className="num" style={{ color: colorFor(p.value, options) }}>
                {formatValue(p.value, options)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
