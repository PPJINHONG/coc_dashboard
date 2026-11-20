import type { Bootstrap, DataRow } from "../../shared/api/operations";
import { monthAt, useResourceHistory } from "./useResourceHistory";
import Icon from "../../shared/components/Icon";
import { amountText, areaOrder, formatCount, locations, measure, metrics } from "./resourceMetrics";

export default function ResourceTopology({ rows, data, country, month, revision }: {
  rows: DataRow[]; data: Bootstrap; country: string; month: string; revision: number;
}) {
  const previous = monthAt(month, -1);
  const { months, error, retry } = useResourceHistory(previous, 1, revision);
  const past = months?.[previous];
  const previousSites = locations(past ?? [], data);
  const sites = locations(rows, data);
  const areas = country ? [country] : areaOrder(sites.map((site) => site.area));
  const hosts = measure(rows, "host_count");
  return (
    <section className="resource-map resource-visual-panel" aria-label="인프라 자원 구성도">
      <header className="resource-visual-header"><h2>권역별 자원 구성도</h2><span>{month} 기준</span>{error && <button className="btn btn-sm" onClick={retry}>전월 조회 재시도</button>}</header>
      <div className="resource-tree">
        <article className="resource-root-node">
          <header><Icon name="globe" size={18} /><strong>{country || "전체 인프라"}</strong></header>
          <small>총 Host</small><b>{amountText(hosts)}</b>
          <dl>{metrics.slice(1).map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{amountText(measure(rows, key))}</dd></div>)}</dl>
          <footer>리전 {formatCount(sites.length)}개</footer>
        </article>
        <div className="resource-tree-branches">
          {areas.map((area) => {
            const members = sites.filter((site) => site.area === area);
            const counts = measure(members.flatMap((site) => site.rows), "host_count");
            const before = measure(previousSites.filter((site) => site.area === area).flatMap((site) => site.rows), "host_count");
            const change = counts.value !== null && before.value !== null && !counts.incomplete && !before.incomplete
              ? counts.value - before.value : null;
            return <div className={`resource-branch resource-area-${area.toLowerCase()}`} key={area}>
              <article className="resource-area-node"><h3><i />{area}</h3>
                <strong>{amountText(counts)} <small>Host</small></strong>
                <p className="resource-host-change"><span>전월 대비 Host</span>
                  <b>{error ? "조회 실패" : !months ? "조회 중…" : change === null ? "비교 자료 부족"
                    : `${change > 0 ? "+" : change < 0 ? "−" : ""}${formatCount(Math.abs(change))}대`}</b>
                </p>
              </article>
              <div className="resource-leaves">
                {members.map((site) => <div className="resource-leaf" key={site.id}><article>
                  <header><strong>{site.name}</strong><span>{site.rows.map((row) => String(row.service)).join(" · ")}</span></header>
                  <dl>{metrics.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{amountText(measure(site.rows, key))}</dd></div>)}</dl>
                </article></div>)}
                {!members.length && <div className="resource-leaf"><p>등록된 자원이 없습니다.</p></div>}
              </div>
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}
