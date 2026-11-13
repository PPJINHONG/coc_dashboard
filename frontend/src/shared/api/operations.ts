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
  /** 월별 데이터 변경의 기준 월(YYYY-MM). 공통데이터·운영 인력 변경은 null */
  month: string | null;
  action: string;
  actor_name: string;
  summary: string;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}
/**
 * 기준 월 데이터 전체 (/api/operations/current/?month=YYYY-MM).
 * 기능별 행 목록은 기능 이름(resources·staff·work 등)을 키로 들어 있습니다. sectionRows()로 꺼냅니다.
 * 인프라 자원·운영 작업은 month의 행만, 운영 인력은 월과 관계없이 전체 행입니다.
 */
export type Snapshot = {
  revision: number;
  updated_at: string;
  /** 조회한 기준 월(YYYY-MM). 저장할 때 같은 값을 보냅니다. */
  month: string;
  /** 기능별 합계. 키는 각 기능 앱의 feature.py totals가 정합니다(예: hosts·vms·storage). */
  totals: Record<string, number>;
  logs: Log[];
} & { readonly [section: string]: unknown };

export const sectionRows = (snapshot: Snapshot, section: string) =>
  (snapshot[section] ?? []) as DataRow[];

const root = "/api/operations";
export const bootstrap = () => request<Bootstrap>("GET", `${root}/bootstrap/`);
/** month(YYYY-MM)를 생략하면 서버가 이번 달로 처리합니다. */
export const snapshot = (month?: string) =>
  request<Snapshot>(
    "GET",
    `${root}/current/${month ? `?month=${encodeURIComponent(month)}` : ""}`,
  );
/** DB 관리 > 기능별 설정에서 기준 월의 기능 데이터 전체를 저장합니다(관리자 전용). 다른 달 행은 바뀌지 않습니다. */
export const saveRows = (
  revision: number,
  section: string,
  rows: DataRow[],
  month: string,
) =>
  request("PUT", `/api/db-admin/sections/${section}/`, {
    revision,
    month,
    rows,
  });

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
