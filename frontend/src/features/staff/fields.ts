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
  ];
}
