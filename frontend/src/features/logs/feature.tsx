import "./logs.css";
import type { FeatureDefinition } from "../../shared/feature";
import LogsPage from "./LogsPage";

const feature: FeatureDefinition = {
  id: "logs",
  label: "변경 이력",
  icon: "history",
  order: 90,
  english: "ACTIVITY",
  description: "데이터가 언제, 어떻게 변경되었는지 확인하세요.",
  Page: LogsPage,
};

export default feature;
