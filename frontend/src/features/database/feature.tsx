import "./database.css";
import type { FeatureDefinition } from "../../shared/feature";
import DatabaseAdmin from "./DatabaseAdmin";

/** DB 관리: 공통데이터·기능별 설정·DB 원본. 기능별 설정의 하위 탭은 각 기능 feature.tsx의 admin에서 모읍니다. */
const feature: FeatureDefinition = {
  id: "database",
  label: "DB 관리",
  icon: "database",
  order: 100,
  adminOnly: true,
  // 관리자 진입 경로는 항상 유지합니다.
  hideable: false,
  description: "공통데이터와 기능별 데이터를 관리하고 원본 테이블을 확인하세요.",
  homeCount: () => "데이터 관리",
  Page: ({ data, snapshot, features, refresh, setDirty, setBusy }) => (
    <DatabaseAdmin
      data={data}
      snapshot={snapshot}
      features={features}
      onChanged={refresh}
      onEditing={setDirty}
      onBusy={setBusy}
    />
  ),
};

export default feature;
