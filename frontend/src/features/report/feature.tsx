import type { FeatureDefinition } from "../../shared/feature";

/** 리포트 탭은 추후 다시 개발할 수 있도록 메뉴만 유지합니다. */
const feature: FeatureDefinition = {
  id: "report",
  label: "리포트",
  icon: "layers",
  order: 10,
  english: "OVERVIEW",
  description: "리포트 화면은 추후 제공할 예정입니다.",
  homeCount: () => "준비 중",
  Page: () => null,
};

export default feature;
