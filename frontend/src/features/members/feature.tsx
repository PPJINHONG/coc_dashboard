import homeLogo from "./home-logo.svg";
import type { FeatureDefinition } from "../../shared/feature";
import MembersPage from "./MembersPage";
import "./members.css";

const feature: FeatureDefinition = {
  id: "members",
  label: "회원정보",
  icon: "users",
  order: 90,
  allowedRoles: ["admin"],
  management: true,
  homeCard: { logo: homeLogo, tone: "navy" },
  description: "회원 정보와 역할, 관리 권역 및 계정 상태를 관리하세요.",
  Page: MembersPage,
};
export default feature;
