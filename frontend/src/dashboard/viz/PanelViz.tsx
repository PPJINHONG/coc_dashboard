// 패널 본문: 데이터 처리 결과를 시각화 유형별 컴포넌트로 넘긴다.
import type { PanelInput } from '../../api/dashboard';
import { buildSeries } from '../data';
import GaugeViz from './GaugeViz';
import StatViz from './StatViz';
import TableViz from './TableViz';
import XYChart from './XYChart';

export default function PanelViz({ panel }: { panel: PanelInput }) {
  const series = buildSeries(panel);
  if (series.error) {
    return (
      <div className="viz-message viz-error" role="alert">
        <span aria-hidden="true">⚠</span> {series.error}
      </div>
    );
  }
  if (series.points.length === 0) {
    return <div className="viz-message">표시할 데이터가 없습니다. 편집에서 값을 입력해 주세요.</div>;
  }
  const { points } = series;
  const o = panel.options;
  return (
    <div className="viz-body">
      {panel.viz_type === 'timeseries' && <XYChart points={points} options={o} kind="line" />}
      {panel.viz_type === 'bar' && <XYChart points={points} options={o} kind="bar" />}
      {panel.viz_type === 'stat' && <StatViz points={points} options={o} />}
      {panel.viz_type === 'gauge' && <GaugeViz points={points} options={o} />}
      {panel.viz_type === 'table' && <TableViz points={points} options={o} hasFormula={panel.formula.trim() !== ''} />}
      {series.warning && (
        <div className="viz-warning" title={series.warning}>
          <span aria-hidden="true">⚠</span> {series.warning}
        </div>
      )}
    </div>
  );
}
