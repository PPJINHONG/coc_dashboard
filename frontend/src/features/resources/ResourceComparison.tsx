import { useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import Icon from "../../shared/components/Icon";
import ResourceTrendCharts, { type Period } from "./ResourceTrendCharts";
import { amountText, areaOrder, formatCount, locations, measure, trendMetrics, difference, signed, type Quantity } from "./resourceMetrics";
import { monthAt, useResourceHistory } from "./useResourceHistory";

function SiteRanking({ first, last, metric, unit }: { first: Period; last: Period; metric: Quantity; unit: string }) {
  const before = new Map(first.sites.map((site) => [site.id, site]));
  const after = new Map(last.sites.map((site) => [site.id, site]));
  const ranks = [...new Map([...before, ...after]).values()].map(({ id, name }) => {
    const now = measure(after.get(id)?.rows ?? [], metric);
    const base = measure(before.get(id)?.rows ?? [], metric);
    return { id, name, now, change: difference(now, base), base: base.value };
  }).sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity) || a.name.localeCompare(b.name, "ko"));
  const max = Math.max(1, ...ranks.map((rank) => Math.abs(rank.change ?? 0)));
  return <section className="resource-visual-panel resource-rank"><header className="resource-visual-header">
    <h2>리전별 순증감 순위</h2><span>{first.month} → {last.month}</span></header>
    {ranks.length ? <ol>{ranks.map(({ id, name, now, change, base }, i) => <li key={id}>
      <div><strong>{change !== null && `${i + 1}. `}{name}</strong>
        <b>{change === null ? "비교 자료 부족" : `${signed(change)}${unit}`}</b></div>
      {change !== null && <span className="resource-rank-track"><i style={{width: Math.abs(change) / max * 100 + "%", background: change < 0 ? "#927257" : undefined}} /></span>}
      <small>기준 월 {amountText(now)}{base != null && base > 0 && change !== null && ` · 증감률 ${(change / base * 100).toLocaleString("ko-KR", {maximumFractionDigits: 1, signDisplay: "exceptZero"})}%`}</small>
    </li>)}</ol> : <p className="resource-comparison-message">비교할 리전 데이터가 없습니다.</p>}
  </section>;
}

export default function ResourceComparison({ data, snapshot }: FeaturePageProps) {
  const [length, setLength] = useState(12);
  const [metric, setMetric] = useState<Quantity>("host_count");
  const { months, error, retry } = useResourceHistory(snapshot.month, length, snapshot.revision);
  const periods = Array.from({ length }, (_, i) => {
    const month = monthAt(snapshot.month, i - length + 1);
    const rows = months?.[month] ?? [];
    return { month, rows, sites: locations(rows, data) };
  });
  const first = periods[0], last = periods[length - 1];
  const areas = areaOrder(periods.flatMap(({ sites }) => sites.map((site) => site.area)));
  const selected = trendMetrics.find((item) => item.key === metric)!;
  const unit = selected.unit;
  return <div className="infrastructure-page resource-trends">
    <header className="page-heading"><div><span className="eyebrow">INFRASTRUCTURE</span><h1>인프라 자원 증감 추이</h1>
      <p>권역별 월간 수량과 리전별 순증감을 확인합니다.</p></div>
    </header>
    <div className="resource-period-bar"><div className="resource-range"><Icon name="clock" size={19} /><div><small>조회 기간</small><strong>{first.month} — {last.month}</strong></div></div>
      <div role="group" aria-label="조회 기간">{[2, 3, 6, 12].map((n) =>
        <button key={n} className="resource-period-choice" data-period={n} aria-pressed={length === n} onClick={() => setLength(n)}>
          <i aria-hidden="true" />{n === 2 ? "전월 비교" : n === 12 ? "1년" : `${n}개월`}</button>)}</div></div>
    {error ? <p role="alert" className="resource-comparison-message">{error} <button className="btn btn-sm" onClick={retry}>다시 시도</button></p>
      : !months ? <p role="status" className="resource-comparison-message">자원 추이를 불러오는 중입니다.</p>
      : <>
        <div className="resource-compare-metrics" role="group" aria-label="비교 지표">{trendMetrics.map(({key, label, unit}) => {
          const current = measure(last.rows, key);
          const change = difference(current, measure(first.rows, key));
          return <button key={key} aria-pressed={key === metric} onClick={() => setMetric(key)}>
            <span>{label}</span><strong>{amountText(current)} {current.value !== null && !current.incomplete && <small>{unit}</small>}</strong>
            <b>{first.month} 대비 {change === null ? "비교 자료 부족" : signed(change) + unit}</b>
          </button>;
        })}</div>
        <div className="resource-trend-layout">
          <ResourceTrendCharts periods={periods} metric={metric} areas={areas} label={selected.label} unit={unit} />
          <SiteRanking first={first} last={last} metric={metric} unit={unit} />
        </div>
      </>}
  </div>;
}
