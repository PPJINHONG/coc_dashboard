import type { ReportEntry, ReportFigure } from "../../shared/featureReport";
import type { Chapter } from "../../shared/report/loadReport";

const format = (value: number) => value.toLocaleString("ko-KR");

function entryFact(entry: ReportEntry, label: string) {
  return entry.facts.find(([key]) => key === label)?.[1] ?? "";
}

function figureText(figure?: ReportFigure) {
  if (!figure || figure.value == null) return "미등록";
  return `${format(figure.value)}${figure.unit}`;
}

export default function ReportOverview({ chapters, period }: { chapters: Chapter[]; period: string }) {
  const resources = chapters.find(({ id }) => id === "resources")?.figures ?? [];
  const staff = chapters.find(({ id }) => id === "staff")?.figures ?? [];
  const requests = chapters.find((chapter) => chapter.requests)?.requests;
  const handovers = chapters.find((chapter) => chapter.entries)?.entries ?? [];
  const notices = chapters.find((chapter) => chapter.timeline)?.timeline ?? [];
  const resource = (label: string) => resources.find((item) => item.label === label);
  const requestNow = requests?.regions.reduce((sum, item) => sum + item.now, 0) ?? 0;
  const requestPrior = requests?.regions.reduce((sum, item) => sum + item.prior, 0) ?? 0;
  const requestDelta = requestNow - requestPrior;
  const staffTotal = staff.length ? staff.reduce((sum, item) => sum + (item.value ?? 0), 0) : null;
  const completedHandovers = handovers.filter((entry) => entryFact(entry, "상태") === "완료").length;
  const activeHandovers = handovers.length - completedHandovers;
  const importantHandovers = handovers.filter((entry) => entryFact(entry, "우선순위") === "중요").length;
  const monthlyActivity = handovers.length + notices.length + requestNow;

  return <div className="monthly-summary">
    <section className="summary-lead-card">
      <span>MONTHLY SNAPSHOT</span>
      <h3>{period}<br />운영 현황</h3>
      <p>인프라·인력·핸드오버·월간 업무의 전체 합계 기준 요약</p>
      <div><small>월간 활동 합계</small><strong>{format(monthlyActivity)}<i>건</i></strong></div>
    </section>

    <section className="summary-infrastructure-card">
      <header><span>INFRASTRUCTURE</span><h3>인프라 자원 합계</h3></header>
      <dl>
        {["Host", "VM", "전체 Rack"].map((label) => {
          const item = resource(label);
          return <div key={label}>
            <dt>{label}</dt>
            <dd>{figureText(item)}</dd>
            <small>{item?.incomplete ? "미입력 항목 포함" : "기준 월 등록값"}</small>
          </div>;
        })}
      </dl>
    </section>

    <section className="summary-metric-card summary-staff-card">
      <span>PEOPLE</span>
      <h3>운영 인력</h3>
      <strong>{staffTotal == null ? "—" : format(staffTotal)}<small>{staffTotal == null ? "" : "명"}</small></strong>
      <p>조회 시점 등록 인원</p>
    </section>

    <section className="summary-metric-card summary-handover-card">
      <span>HANDOVER</span>
      <h3>상시 핸드오버</h3>
      <strong>{format(handovers.length)}<small>건</small></strong>
      <p>미완료 {activeHandovers} · 완료 {completedHandovers} · 중요 {importantHandovers}</p>
    </section>

    <section className="summary-metric-card summary-notice-card">
      <span>NOTICE</span>
      <h3>월간 작업공지</h3>
      <strong>{format(notices.length)}<small>건</small></strong>
      <p>선택한 기준 월의 전체 공지</p>
    </section>

    <section className="summary-metric-card summary-request-card">
      <span>REQUEST</span>
      <h3>월간 요청작업</h3>
      <strong>{format(requestNow)}<small>건</small></strong>
      <p>전월 {format(requestPrior)}건 · 전월 대비 {requestDelta > 0 ? "+" : ""}{format(requestDelta)}건</p>
    </section>
  </div>;
}
