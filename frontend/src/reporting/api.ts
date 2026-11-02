import { request } from "../api/client";

export type Section = "resources" | "staff" | "work" | "issues";
export type Tab = "home" | "report" | Section | "logs" | "database";
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
export interface Bootstrap {
  regions: Region[];
  services: Service[];
  staff_members: StaffMember[];
  can_manage: boolean;
  development_mode: boolean;
}
export interface Totals {
  hosts: number;
  vms: number;
  storage: number;
  staff: number;
  work_total: number;
  work_completed: number;
  missing_vm_rows: number;
  missing_storage_rows: number;
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
export interface IssueComment {
  id: number;
  author_name: string;
  content: string;
  created_at: string;
  /** 현재 사용자가 수정·삭제할 수 있는지(관리자 또는 작성자 본인) */
  can_edit?: boolean;
}
export type Snapshot = Record<Section, DataRow[]> & {
  revision: number;
  updated_at: string;
  totals: Totals;
  logs: Log[];
};
export type MasterKind = "regions" | "services" | "staff-members";

const root = "/api/operations";
export const bootstrap = () => request<Bootstrap>("GET", `${root}/bootstrap/`);
export const snapshot = () => request<Snapshot>("GET", `${root}/current/`);
export const saveRows = (revision: number, section: Section, rows: DataRow[]) =>
  request("PUT", `/api/db-admin/sections/${section}/`, { revision, rows });
export const saveMaster = (
  kind: MasterKind,
  values: Record<string, unknown>,
  pk?: string | number,
) =>
  request(
    pk === undefined ? "POST" : "PATCH",
    `/api/db-admin/common/${kind}/${pk === undefined ? "" : `${encodeURIComponent(pk)}/`}`,
    values,
  );
export const deleteMaster = (kind: MasterKind, pk: string | number) =>
  request("DELETE", `/api/db-admin/common/${kind}/${encodeURIComponent(pk)}/`);
export const addComment = (revision: number, id: number, content: string) =>
  request("POST", `/api/db-admin/issues/${id}/comments/`, {
    revision,
    content,
  });
export const getLogs = () => request<Log[]>("GET", `${root}/logs/`);

// 리전 이슈 사용자 작성: 관리자는 전체, 사용자는 본인 것만, 옵저버는 조회만 가능합니다.
export const createIssue = (values: DataRow) =>
  request<{ revision: number; row: DataRow }>("POST", `${root}/issues/`, values);
export const updateIssue = (id: number, values: DataRow) =>
  request<{ revision: number; row: DataRow }>("PATCH", `${root}/issues/${id}/`, values);
export const deleteIssue = (id: number) =>
  request("DELETE", `${root}/issues/${id}/`);
export const postIssueComment = (id: number, content: string) =>
  request("POST", `${root}/issues/${id}/comments/`, { content });
export const updateIssueComment = (id: number, content: string) =>
  request("PATCH", `${root}/issue-comments/${id}/`, { content });
export const deleteIssueComment = (id: number) =>
  request("DELETE", `${root}/issue-comments/${id}/`);

export interface NavigationPreference {
  hidden_tabs: Tab[];
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
