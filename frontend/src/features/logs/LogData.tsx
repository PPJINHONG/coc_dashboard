import type { Bootstrap, Log } from "../../shared/api/operations";
import type { HistoryLog } from "./api";

type Row = Record<string, unknown>;
const LABELS: Record<string, string> = {
  region: "리전", region_id: "리전", region_name: "리전명", country_code: "국가", period_month: "기준 월", month: "기준 월",
  service: "서비스", service_code: "서비스 코드", service_name: "서비스명", host_count: "Host", vm_count: "VM",
  compute_rack_count: "Compute Rack", storage_count: "Storage Rack", remarks: "비고", notes: "비고",
  staff: "성명", staff_id: "성명", staff_name: "성명", staff_member_id: "성명", job_title: "직책", company_name: "소속사",
  job_description: "업무", work_location: "근무지", pc_ip: "PC IP", autoever_account: "오토에버 계정", z_account: "Z 계정",
  work_type: "작업 유형", scope: "범위", total_count: "전체 작업", completed_count: "완료 작업", failed_count: "실패 작업",
  batch_count: "일괄 작업", delayed_count: "지연 작업", mttr_minutes: "평균 복구 시간(분)",
  avg_recovery_minutes: "평균 복구 시간(분)", title: "제목", description: "상세 내용", severity: "중요도", status: "상태",
  progress_percent: "진행률", owner: "담당자", owner_id: "담당자", owner_name: "담당자명", next_action: "다음 조치",
  author_name: "작성자", content: "댓글 내용", comments: "댓글",
  requester: "요청자", requested_at: "요청일", schedule_timezone: "시간대", schedule_start: "작업 시작", schedule_end: "작업 종료",
  assignee_regions: "담당 권역", assignee_name: "담당자", content_html: "작업 내용", file: "첨부파일", original_name: "파일명",
  kind: "구분", value: "선택지",
};
const HIDDEN = new Set(["id", "issue", "issue_id", "request_id", "author_id", "uploader_id", "region_code", "staff_code", "updated_at", "created_at", "can_edit", "author_username", "actor_username", "password"]);
const VALUES: Record<string, string> = { critical: "긴급", major: "높음", minor: "보통", info: "안내", open: "진행중", blocked: "보류", resolved: "완료",
  request: "요청작업", change: "변경작업", incident: "장애대응", infra: "인프라", automation: "자동화" };

function rows(value: unknown): Row[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Row;
  return Array.isArray(record.rows) ? record.rows as Row[] : [record];
}
function identity(row: Row, index: number) {
  const kind = "file" in row ? "image" : "content" in row ? "comment" : ("staff_id" in row || "staff" in row) ? "assignment" : "staff_name" in row ? "member" : "row";
  return `${kind}:${row.id ?? row.service_code ?? index}`;
}

export default function LogData({ log, data }: { log: Log; data: Bootstrap }) {
  const regions = [...data.regions, ...((log as HistoryLog).regions ?? [])];
  const regionName = (id: unknown) => regions.find((item) => item.id === id)?.region_name ?? "이전 리전";
  const name = (row: Row) => String(row.title ?? row.staff_name ?? row.region_name ?? row.service_name ??
    (row.region_id || row.region ? regionName(row.region_id ?? row.region) : "content" in row ? "댓글" : "변경 항목"));
  function show(key: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (["region", "region_id"].includes(key)) return regionName(value);
    if (["staff", "staff_id", "staff_member_id", "owner", "owner_id"].includes(key))
      return data.staff_members.find((item) => item.id === value)?.staff_name ?? "이전 인력";
    if (key === "service") return data.services.find((item) => item.service_code === value)?.service_name ?? String(value);
    if (key === "status" && log.section === "regional_requests") return ({open:"Open", in_progress:"In Progress", completed:"Completed"} as Record<string,string>)[String(value)] ?? String(value);
    if (key === "assignee_regions" && Array.isArray(value)) return value.join(" · ") || "—";
    if (key === "content_html") {
      const document = new DOMParser().parseFromString(String(value), "text/html");
      return document.body.textContent?.trim() || "첨부 이미지";
    }
    if (key === "comments" && Array.isArray(value)) return value.map((item) => `${item.author_name || "작성자 미상"}: ${item.content}`).join("\n") || "—";
    if (["severity", "status", "work_type", "scope"].includes(key)) return VALUES[String(value)] ?? String(value);
    if (key === "progress_percent") return `${value}%`;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  const before = new Map(rows(log.before_data).map((row, index) => [identity(row, index), row]));
  const after = new Map(rows(log.after_data).map((row, index) => [identity(row, index), row]));
  return <div className="logs-data-tables">
    {[...new Set([...before.keys(), ...after.keys()])].map((id) => {
      const old = before.get(id), current = after.get(id);
      const keys = [...new Set([...Object.keys(old ?? {}), ...Object.keys(current ?? {})])]
        .filter((key) => !HIDDEN.has(key) && JSON.stringify(old?.[key]) !== JSON.stringify(current?.[key]));
      if (!keys.length) return null;
      return <section key={id}>
        <h3>{name(current ?? old ?? {})}<span className="report-badge">{!old ? "등록" : !current ? "삭제" : "수정"}</span></h3>
        <div className="logs-data-scroll"><table className="report-table logs-data-table">
          <thead><tr><th scope="col">항목</th><th scope="col">변경 전</th><th scope="col">변경 후</th></tr></thead>
          <tbody>{keys.map((key) => <tr key={key}><th scope="row">{LABELS[key] ?? key}</th><td>{show(key, old?.[key])}</td><td>{show(key, current?.[key])}</td></tr>)}</tbody>
        </table></div>
      </section>;
    })}
  </div>;
}
