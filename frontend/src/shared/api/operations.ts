import { request } from "./client";

/** 기능별 현재값 한 행. 열은 기능마다 다르므로 키는 기능의 fields.ts에서 정합니다. */
export interface DataRow {
  id?: number;
  region?: number;
  country_code?: "KR" | "EU" | "NA";
  [key: string]: unknown;
}
export interface Region {
  id: number;
  region_name: string;
  country_code: string;
}
export interface Service {
  service_code: string;
  service_name: string;
}
export interface StaffMember {
  id: number;
  staff_name: string;
}
/** 리전·서비스·인력 공통데이터 (/api/operations/bootstrap/) */
export interface Bootstrap {
  regions: Region[];
  services: Service[];
  staff_members: StaffMember[];
  can_manage: boolean;
  development_mode: boolean;
}
export interface Log {
  id: number;
  section: string;
  action: string;
  actor_name: string;
  summary: string;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}
/**
 * 현재값 전체 (/api/operations/current/).
 * 기능별 행 목록은 기능 이름(resources·staff·work·issues 등)을 키로 들어 있습니다. sectionRows()로 꺼냅니다.
 */
export type Snapshot = {
  revision: number;
  updated_at: string;
  /** 기능별 합계. 키는 각 기능 앱의 feature.py totals가 정합니다(예: hosts·vms·storage). */
  totals: Record<string, number>;
  logs: Log[];
} & { readonly [section: string]: unknown };

export const sectionRows = (snapshot: Snapshot, section: string) =>
  (snapshot[section] ?? []) as DataRow[];

const root = "/api/operations";
export const bootstrap = () => request<Bootstrap>("GET", `${root}/bootstrap/`);
export const snapshot = () => request<Snapshot>("GET", `${root}/current/`);
/** DB 관리 > 기능별 설정에서 기능의 현재값 전체를 저장합니다(관리자 전용). */
export const saveRows = (revision: number, section: string, rows: DataRow[]) =>
  request("PUT", `/api/db-admin/sections/${section}/`, { revision, rows });

export interface NavigationPreference {
  hidden_tabs: string[];
  sidebar_collapsed: boolean;
}
export const navigationPreference = () =>
  request<NavigationPreference>("GET", "/api/navigation/preferences/");
export const saveNavigationPreference = (values: NavigationPreference) =>
  request<NavigationPreference>(
    "PATCH",
    "/api/navigation/preferences/",
    values,
  );
