import type { Bootstrap } from "../../shared/api/operations";
import { choices, regionField, staffMemberOptions, type Field } from "../../shared/fields";

export const STATUSES: Record<string, string> = {
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

/** 리전 이슈 열. 백엔드 features/issues/serializers.py와 같은 이름을 씁니다. */
export function issueFields(data: Bootstrap): Field[] {
  return [
    regionField(data),
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
      options: choices(STATUSES),
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
      numberValue: true,
      options: [{ value: "", label: "미지정" }, ...staffMemberOptions(data)],
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
