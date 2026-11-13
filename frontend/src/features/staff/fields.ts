import type { Bootstrap } from "../../shared/api/operations";
import { staffMemberOptions, type Field } from "../../shared/fields";

/** 운영 인력 배치 열. 백엔드 features/staff/serializers.py와 같은 이름을 씁니다. */
export function staffFields(data: Bootstrap): Field[] {
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
      numberValue: true,
      options: staffMemberOptions(data),
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
    ...ACCESS_FIELDS,
  ];
}

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
export function staffEditFields(countries: string[]): Field[] {
  return [
    {
      key: "country_code",
      label: "국가",
      type: "select",
      options: countries.map((code) => ({ value: code, label: code })),
      default: countries[0],
    },
    { key: "staff_name", label: "성명" },
    { key: "job_title", label: "직책", default: "" },
    { key: "company_name", label: "소속사", default: "" },
    { key: "job_description", label: "업무", type: "textarea", default: "" },
    { key: "work_location", label: "근무지", default: "" },
    ...ACCESS_FIELDS,
  ];
}
