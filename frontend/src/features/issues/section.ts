import type { DataRow } from "../../shared/api/operations";
import type { SectionConfig } from "../../shared/sections/types";
import { issueFields } from "./fields";

/** 리전 이슈 목록 설정. 일반 화면(IssuesPage)과 DB 관리 편집이 함께 씁니다. 본문은 카드로 직접 그립니다. */
export const issueSection: SectionConfig = {
  key: "issues",
  label: "리전 이슈",
  fields: issueFields,
  filterKey: "region",
  searchPlaceholder: "이름, 분류, 비고 검색",
  statusFilter: true,
  editorHint: "복사한 인력은 성명을, 작업은 리전·구분·대상을 선택하세요. 삭제한 행은 저장 시 반영됩니다.",
  addLabel: "+ 이슈 등록",
  editLayout: "cards",
  // 완료로 바꾸면 진행률을 100%로 맞춥니다(서버도 같은 규칙을 검사합니다).
  onFieldChange: (key, value): DataRow =>
    key === "status" && value === "resolved" ? { progress_percent: 100 } : {},
};
