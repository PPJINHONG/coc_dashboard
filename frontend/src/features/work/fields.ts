import type { Bootstrap } from "../../shared/api/operations";
import { choices, regionField, remarksField, type Field } from "../../shared/fields";

export const WORK_TYPES: Record<string, string> = {
  request: "요청작업",
  change: "변경작업",
  incident: "장애대응",
};

/** 운영 작업 열. 백엔드 features/work/serializers.py와 같은 이름을 씁니다. */
export function workFields(data: Bootstrap): Field[] {
  return [
    regionField(data),
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
    remarksField,
  ];
}
