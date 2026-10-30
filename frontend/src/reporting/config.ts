import type { IconName } from "../components/Icon";
import type { Bootstrap, DataRow, Section, Tab } from "./api";

export const TABS: { id: Tab; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { id: "home", label: "홈", icon: "home" },
  { id: "report", label: "리포트", icon: "layers" },
  { id: "resources", label: "인프라 자원", icon: "server" },
  { id: "staff", label: "운영 인력", icon: "users" },
  { id: "work", label: "운영 작업", icon: "work" },
  { id: "issues", label: "리전 이슈", icon: "flag" },
  { id: "logs", label: "변경 이력", icon: "history", adminOnly: true },
  { id: "database", label: "DB 관리", icon: "database", adminOnly: true },
];
export const canAccessTab = (id: Tab, isAdmin: boolean) =>
  isAdmin || !TABS.find((tab) => tab.id === id)?.adminOnly;
export const SECTION_LABELS = Object.fromEntries(
  TABS.map((tab) => [tab.id, tab.label]),
);
export const WORK_TYPES: Record<string, string> = {
  request: "요청작업",
  change: "변경작업",
  incident: "장애대응",
};
export const STATUSES: Record<string, string> = {
  active: "정상 투입중",
  oncall: "온콜 대기",
  leave: "휴무",
  excluded: "투입 제외",
  open: "진행중",
  blocked: "보류",
  resolved: "완료",
};
export const SEVERITIES: Record<string, string> = {
  critical: "긴급",
  major: "높음",
  minor: "보통",
  info: "안내",
};
export interface Option {
  value: string;
  label: string;
}
export interface Field {
  key: string;
  label: string;
  type?: "number" | "textarea" | "select";
  options?: Option[];
  nullable?: boolean;
  max?: number;
  step?: string;
  default?: unknown;
}
const choices = (items: Record<string, string>) =>
  Object.entries(items).map(([value, label]) => ({ value, label }));

export function fields(section: Section, data: Bootstrap): Field[] {
  const region: Field = {
    key: "region",
    label: "리전",
    type: "select",
    options: data.regions.map((r) => ({
      value: String(r.id),
      label: r.region_name,
    })),
  };
  const service: Field = {
    key: "service",
    label: "서비스",
    type: "select",
    options: data.services.map((s) => ({
      value: s.service_code,
      label: s.service_name,
    })),
  };
  const remarks: Field = {
    key: "remarks",
    label: "비고",
    type: "textarea",
    default: "",
  };
  switch (section) {
    case "resources":
      return [
        region,
        service,
        { key: "environment_name", label: "환경", default: "운영" },
        { key: "host_count", label: "Host", type: "number" },
        { key: "vm_count", label: "VM", type: "number", nullable: true },
        {
          key: "storage_count",
          label: "Storage",
          type: "number",
          nullable: true,
        },
        remarks,
      ];
    case "staff":
      return [
        {
          key: "country_code",
          label: "국가",
          type: "select",
          options: ["KR", "EU", "NA"].map((code) => ({ value: code, label: code })),
        },
        {
          key: "staff",
          label: "성명",
          type: "select",
          options: data.staff_members.map((s) => ({
            value: String(s.id),
            label: s.staff_name,
          })),
        },
        { key: "job_title", label: "직책" },
        { key: "company_name", label: "소속사" },
        {
          key: "job_description",
          label: "업무",
          type: "textarea",
          default: "",
        },
        { key: "work_location", label: "근무지", default: "" },
      ];
    case "work":
      return [
        region,
        {
          key: "work_type",
          label: "구분",
          type: "select",
          options: choices(WORK_TYPES),
        },
        {
          key: "scope",
          label: "대상",
          type: "select",
          options: choices({ infra: "인프라", automation: "자동화" }),
        },
        { key: "total_count", label: "전체", type: "number" },
        { key: "completed_count", label: "완료", type: "number" },
        { key: "batch_count", label: "정기배치", type: "number" },
        { key: "delayed_count", label: "지연", type: "number" },
        {
          key: "mttr_minutes",
          label: "평균 복구(분)",
          type: "number",
          nullable: true,
          step: "0.1",
        },
        remarks,
      ];
    case "issues":
      return [
        region,
        { key: "title", label: "이슈 제목" },
        {
          key: "severity",
          label: "중요도",
          type: "select",
          options: choices(SEVERITIES),
          default: "minor",
        },
        {
          key: "status",
          label: "상태",
          type: "select",
          options: choices({
            open: STATUSES.open,
            blocked: STATUSES.blocked,
            resolved: STATUSES.resolved,
          }),
        },
        {
          key: "progress_percent",
          label: "진행률 (%)",
          type: "number",
          max: 100,
        },
        {
          key: "owner",
          label: "담당자",
          type: "select",
          nullable: true,
          options: [
            { value: "", label: "미지정" },
            ...data.staff_members.map((s) => ({
              value: String(s.id),
              label: s.staff_name,
            })),
          ],
        },
        {
          key: "description",
          label: "상세 내용",
          type: "textarea",
          default: "",
        },
        {
          key: "next_action",
          label: "다음 조치",
          type: "textarea",
          default: "",
        },
      ];
  }
}

export function emptyRow(section: Section, data: Bootstrap): DataRow {
  return Object.fromEntries(
    fields(section, data).map((f) => [
      f.key,
      f.default ??
        (f.nullable
          ? null
          : f.type === "number"
            ? 0
            : f.type === "select"
              ? (f.options?.[0]?.value
                ? ["region", "staff", "owner"].includes(f.key)
                  ? Number(f.options[0].value)
                  : f.options[0].value
                : "")
              : ""),
    ]),
  ) as DataRow;
}
export function cell(row: DataRow, field: Field): string {
  const value = row[field.key];
  if (value === null || value === undefined || value === "")
    return field.nullable ? "미입력" : "—";
  if (field.options)
    return (
      field.options.find((o) => o.value === String(value))?.label ??
      String(value)
    );
  return field.type === "number"
    ? Number(value).toLocaleString("ko-KR")
    : String(value);
}
export function localDate(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}
export function exportCsv(section: Section, rows: DataRow[], data: Bootstrap) {
  const columns = fields(section, data);
  const escape = (text: string) =>
    `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  const content = [
    columns.map((f) => f.label),
    ...rows.map((r) => columns.map((f) => cell(r, f))),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${new Date().toISOString().slice(0, 10)}_${section}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
