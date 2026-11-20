import type { Bootstrap } from "../../shared/api/operations";
import { staffMemberOptions, type Field } from "../../shared/fields";

/** 운영 인력 배치 열. 백엔드 features/staff/serializers.py와 같은 이름을 씁니다. */
export function staffFields(data: Bootstrap, withGrade = false): Field[] {
  return [
    { key: "global_region", label: "도메인" },
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
      numberValue: true,
      options: staffMemberOptions(data),
    },
    { key: "job_title", label: "직책" },
    { key: "company_name", label: "소속사" },
    { key: "work_status", label: "근무 상태", options: WORK_STATUSES },
    { key: "status_detail", label: "상태 정보" },
    { key: "deployment_date", label: "업무 투입일" },
    { key: "resignation_date", label: "회사 퇴사일" },
    ...(withGrade ? [{ key: "grade", label: "등급" }] : []),
    {
      key: "job_description",
      label: "업무",
      type: "textarea",
      default: "",
    },
    { key: "work_location", label: "근무지", default: "" },
    ...ACCESS_FIELDS,
    { key: "account_name", label: "연결 회원" },
  ];
}

/**
 * 권역 현지 날짜·시각과 권역 근무 시간(권역 설정, 미등록 시 09:00~18:00)으로 서버가 계산한 상태입니다.
 * 실제 출퇴근 기록이 아니라 근무 시간표 기준입니다.
 */
export const WORK_STATUSES = [
  { value: "on_duty", label: "출근" },
  { value: "off_duty", label: "퇴근" },
  { value: "leave", label: "휴가" },
  { value: "planned", label: "투입 예정" },
  { value: "retired", label: "퇴사" },
];

/** 접속·계정 정보 열. 형식이 제각각이라 문자열로 입력합니다. */
const ACCESS_FIELDS: Field[] = [
  { key: "pc_ip", label: "PC IP", default: "" },
  { key: "autoever_account", label: "오토에버 계정", default: "" },
  { key: "z_account", label: "Z 계정", default: "" },
];

/**
 * 운영 인력 탭 편집 열. 성명은 이름으로 입력하고, 국가는 편집 가능한 국가(그룹장은 관리 국가)만 고릅니다.
 * 백엔드 features/staff/serializers.py StaffEditSerializer와 같은 이름을 씁니다.
 */
export function staffEditFields(countries: string[], role?: string | null, currentTitle?: string): Field[] {
  const level = role === "admin" ? 4 : role === "team_lead" ? 3 : role === "group_lead" ? 2 : 1;
  const titles = ["팀원", ...["책임", "그룹장", "팀장", "관리자"].slice(0, level)];
  if (currentTitle && !titles.includes(currentTitle) && !["그룹장", "팀장", "관리자"].includes(currentTitle)) titles.push(currentTitle);
  return [
    {
      key: "country_code",
      label: "권역",
      type: "select",
      options: countries.map((code) => ({ value: code, label: ({ KR: "한국", NA: "미국", EU: "유럽" } as Record<string, string>)[code] ?? code })),
      default: countries[0],
    },
    { key: "staff_name", label: "성명" },
    { key: "job_title", label: "직책", type: "select", default: "팀원", options: [{ value: "", label: "미등록" }, ...titles.map((title) => ({ value: title, label: title }))] },
    { key: "company_name", label: "소속사", default: "" },
    { key: "deployment_date", label: "업무 투입일", nullable: true },
    { key: "resignation_date", label: "회사 퇴사일", nullable: true },
    { key: "job_description", label: "업무", type: "textarea", default: "" },
    { key: "work_location", label: "근무지", default: "" },
    ...ACCESS_FIELDS,
  ];
}
