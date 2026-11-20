import "./database.css";
import type { FeatureDefinition } from "../../shared/feature";
import DatabaseAdmin from "./DatabaseAdmin";

/** DB 관리: 허용된 DB 원본 테이블을 읽기 전용으로 조회합니다. */
const feature: FeatureDefinition = {
  id: "database",
  label: "DB 관리",
  icon: "database",
  order: 100,
  adminOnly: true,
  // 관리자 진입 경로는 항상 유지합니다.
  hideable: false,
  description: "등록된 DB 원본 테이블을 읽기 전용으로 확인하세요.",
  homeCount: () => "원본 조회",
  Page: () => <DatabaseAdmin />,
};

export default feature;
