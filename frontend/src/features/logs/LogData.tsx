import type { Bootstrap, Log } from "../../shared/api/operations";
import type { HistoryLog } from "./api";

type Row = Record<string, unknown>;
const LABELS: Record<string, string> = {
  region: "리전", region_id: "리전", region_name: "리전명", country_code: "국가", period_month: "기준 월", month: "기준 월",
  service: "서비스", service_code: "서비스 코드", service_name: "서비스명", host_count: "Host", vm_count: "VM",
  compute_rack_count: "Compute Rack", storage_count: "Storage Rack", remarks: "비고", notes: "비고",
  staff: "성명", staff_id: "성명", staff_name: "성명", staff_member_id: "성명", job_title: "직책", company_name: "소속사",
  job_description: "업무", work_location: "근무지", pc_ip: "PC IP", autoever_account: "오토에버 계정", z_account: "Z 계정",
  deployment_date: "업무 투입일", resignation_date: "회사 퇴사일", grade: "등급", account_id: "연결 회원",
  start_date: "시작일", end_date: "종료일", assignment_id: "인력",
  site_representative_id: "현장대리인", team_lead_id: "팀장", group_lead_id: "그룹장",
  work_type: "작업 유형", scope: "범위", total_count: "전체 작업", completed_count: "완료 작업", failed_count: "실패 작업",
  batch_count: "일괄 작업", delayed_count: "지연 작업", mttr_minutes: "평균 복구 시간(분)",
  avg_recovery_minutes: "평균 복구 시간(분)", title: "제목", description: "상세 내용", severity: "중요도", status: "상태",
  progress_percent: "진행률", owner: "담당자", owner_id: "담당자", owner_name: "담당자명", next_action: "다음 조치",
  author_name: "작성자", content: "댓글 내용", comments: "댓글",
  requester: "요청자", requested_at: "요청일", schedule_timezone: "시간대", schedule_start: "작업 시작", schedule_end: "작업 종료",
  assignee_regions: "담당 권역", assignee_name: "담당자", content_html: "작업 내용", file: "첨부파일", original_name: "파일명",
  kind: "구분", value: "선택지",
  custom_values: "추가 항목", key: "열", label: "열 이름",
};
/** 변경 이력의 원본 모델(app.model) → 화면 이름 */
const MODELS: Record<string, string> = {
  "staff.staffassignment": "운영 인력", "reporting.staffmember": "인력 공통데이터", "staff.staffcalendarevent": "일정",
  "staff.staffresponsibility": "권역 책임자", "staff.staffchoice": "항목 값", "staff.staffcolumn": "추가 열",
  "reporting.region": "리전", "reporting.service": "서비스", "resources.infrastructureresource": "인프라 자원",
  "work.worksummary": "운영 작업", "regional_requests.regionalrequest": "요청작업", "regional_requests.regionalrequestimage": "본문 이미지",
};
const HIDDEN = new Set(["id", "issue", "issue_id", "request_id", "column_id", "author_id", "uploader_id", "region_code", "staff_code", "updated_at", "created_at", "can_edit", "author_username", "actor_username", "password"]);
const VALUES: Record<string, string> = { critical: "긴급", major: "높음", minor: "보통", info: "안내", open: "진행중", blocked: "보류", resolved: "완료",
  request: "요청작업", change: "변경작업", incident: "장애대응", infra: "인프라", automation: "자동화",
  leave: "연차", marriage_leave: "결혼휴가" };

export type ChangeKind = "등록" | "수정" | "삭제";
export interface FieldChange { key: string; label: string; before: string; after: string }
export interface ChangeEntry { id: string; model: string; title: string; kind: ChangeKind; fields: FieldChange[] }

function rows(value: unknown): Row[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Row;
  return Array.isArray(record.rows) ? record.rows as Row[] : [record];
}
function identity(row: Row, index: number) {
  const kind = "file" in row ? "image" : "content" in row ? "comment" : ("staff_id" in row || "staff" in row) ? "assignment" : "staff_name" in row ? "member" : "row";
  return `${kind}:${row.id ?? row.service_code ?? index}`;
}
const empty = (value: unknown) => value === null || value === undefined || value === "" || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value as object).length);

/** 변경 이력 한 건을 항목(행)별 변경 전·후 목록으로 바꿉니다. 목록 미리보기와 상세 화면이 함께 씁니다. */
export function describeLog(log: Log, data: Bootstrap, people: Record<string, string> = {}): ChangeEntry[] {
  const history = log as HistoryLog;
  const regions = [...data.regions, ...(history.regions ?? [])];
  const regionName = (id: unknown) => regions.find((item) => item.id === id)?.region_name ?? "이전 리전";
  const staffName = (id: unknown) => data.staff_members.find((item) => item.id === id)?.staff_name ?? "이전 인력";
  const name = (row: Row) => String(row.title || row.staff_name || row.region_name || row.service_name || row.value || row.label ||
    (row.staff_member_id ? staffName(row.staff_member_id) : "") || (row.assignment_id ? people[String(row.assignment_id)] ?? "" : "") ||
    (row.region_id || row.region ? regionName(row.region_id ?? row.region) : "") || ("content" in row ? "댓글" : "") || row.country_code || "변경 항목");
  function show(key: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (["region", "region_id"].includes(key)) return regionName(value);
    if (["staff", "staff_id", "staff_member_id", "owner", "owner_id"].includes(key)) return staffName(value);
    // 운영 인력 배치 번호(현장대리인·팀장·그룹장·일정 소유자)는 현재 인력 목록의 이름으로 보여 줍니다.
    if (["site_representative_id", "team_lead_id", "group_lead_id", "assignment_id"].includes(key)) return people[String(value)] ?? "이전 인력";
    if (key === "account_id") return "회원 계정 연결";
    if (key === "service") return String(value);
    if (key === "status" && log.section === "regional_requests") return ({ open: "Open", in_progress: "In Progress", completed: "Completed" } as Record<string, string>)[String(value)] ?? String(value);
    if (key === "assignee_regions" && Array.isArray(value)) return value.join(" · ") || "—";
    if (key === "content_html") {
      const document = new DOMParser().parseFromString(String(value), "text/html");
      return document.body.textContent?.trim() || "첨부 이미지";
    }
    if (key === "custom_values" && value && typeof value === "object") return Object.entries(value).map(([column, item]) => `${history.column_labels?.[column] ?? "이전 추가 열"}: ${item}`).join("\n") || "—";
    if (key === "key" && typeof value === "string" && value.startsWith("custom_")) return history.column_labels?.[value] ?? "추가 열";
    if (key === "comments" && Array.isArray(value)) return value.map((item) => `${item.author_name || "작성자 미상"}: ${item.content}`).join("\n") || "—";
    if (["severity", "status", "work_type", "scope", "kind"].includes(key)) return VALUES[String(value)] ?? String(value);
    if (key === "progress_percent") return `${value}%`;
    if (typeof value === "boolean") return value ? "예" : "아니오";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  // 새 이력은 서버가 행별로 짝지은 changes를, 옛 응답은 before/after 목록을 추정해 짝짓습니다.
  const pairs: { model: string; before: Row | null; after: Row | null }[] = history.changes ?? (() => {
    const before = new Map(rows(log.before_data).map((row, index) => [identity(row, index), row]));
    const after = new Map(rows(log.after_data).map((row, index) => [identity(row, index), row]));
    return [...new Set([...before.keys(), ...after.keys()])].map((id) => ({ model: "", before: before.get(id) ?? null, after: after.get(id) ?? null }));
  })();
  return pairs.flatMap((pair, index) => {
    const old = pair.before ?? undefined, current = pair.after ?? undefined;
    const kind: ChangeKind = !old ? "등록" : !current ? "삭제" : "수정";
    const keys = [...new Set([...Object.keys(old ?? {}), ...Object.keys(current ?? {})])].filter((key) => !HIDDEN.has(key) &&
      (kind === "수정" ? JSON.stringify(old?.[key]) !== JSON.stringify(current?.[key]) : !empty((current ?? old)?.[key])));
    if (!keys.length) return [];
    return [{ id: `${pair.model}:${index}`, model: MODELS[pair.model] ?? "", title: name(current ?? old ?? {}), kind,
      fields: keys.map((key) => ({ key, label: LABELS[key] ?? key, before: show(key, old?.[key]), after: show(key, current?.[key]) })) }];
  });
}

/** 목록에서 펼치지 않고 보는 한 줄 요약. 예: "김민결 · 직책 — → 책임 외 2개" */
export function changePreview(entries: ChangeEntry[]) {
  if (!entries.length) return "";
  const first = entries[0];
  const field = first.fields[0];
  const value = (text: string) => text.length > 24 ? `${text.slice(0, 24)}…` : text;
  const detail = first.kind === "수정" ? `${field.label} ${value(field.before)} → ${value(field.after)}${first.fields.length > 1 ? ` 외 ${first.fields.length - 1}개 항목` : ""}`
    : `${first.kind} · 항목 ${first.fields.length}개`;
  return `${first.title} · ${detail}${entries.length > 1 ? ` (외 ${entries.length - 1}건)` : ""}`;
}

/** 상세 화면의 변경 전·후. 수정은 바뀐 항목만 전·후로, 등록은 등록 값만, 삭제는 삭제 전 값만 보여 줍니다. */
export default function LogData({ log, data, people }: { log: Log; data: Bootstrap; people?: Record<string, string> }) {
  const entries = describeLog(log, data, people);
  if (!entries.length) return <p className="report-empty">표시할 변경 내용이 없습니다. 원본이 없는 과거 이력이거나 권한 밖 데이터입니다.</p>;
  return <div className="logs-data-tables">
    {entries.map((entry) => <section key={entry.id} className={`logs-change logs-change-${entry.kind === "등록" ? "create" : entry.kind === "삭제" ? "delete" : "update"}`}>
      <h3><span className={`logs-kind logs-kind-${entry.kind === "등록" ? "create" : entry.kind === "삭제" ? "delete" : "update"}`}>{entry.kind}</span>{entry.model && <span className="report-badge">{entry.model}</span>}{entry.title}<small>{entry.fields.length}개 항목</small></h3>
      <div className="logs-data-scroll"><table className="report-table logs-data-table">
        <thead><tr><th scope="col">항목</th>{entry.kind !== "등록" && <th scope="col">변경 전</th>}{entry.kind !== "삭제" && <th scope="col">변경 후</th>}</tr></thead>
        <tbody>{entry.fields.map((field) => <tr key={field.key}><th scope="row">{field.label}</th>
          {entry.kind !== "등록" && <td className="logs-before">{field.before}</td>}
          {entry.kind !== "삭제" && <td className="logs-after">{field.after}</td>}</tr>)}</tbody>
      </table></div>
    </section>)}
  </div>;
}
