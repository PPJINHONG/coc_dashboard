import { request } from "../../shared/api/client";

export interface DbTable {
  name: string;
  label: string;
  kind: "table" | "view";
  comment: string;
  column_count: number;
  protected: boolean;
}
export interface DbColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  default: string | null;
  comment: string;
  identity: boolean;
  generated: boolean;
  base_type: string;
  domain: string | null;
  sensitive: boolean;
  editable: boolean;
}
export interface TableMeta extends DbTable {
  columns: DbColumn[];
  primary_key: string[];
  constraints: { name: string; type: string; definition: string }[];
  can_edit_rows: boolean;
  can_insert_rows: boolean;
}
export interface Catalog {
  tables: DbTable[];
}
export interface DbRow {
  values: Record<string, unknown>;
  token: string | null;
}
export interface Rows {
  rows: DbRow[];
  total: number;
  limit: number;
  offset: number;
}

const base = "/api/db-admin/";
const tablePath = (table: string) =>
  `${base}tables/${encodeURIComponent(table)}/`;
// DB 원본 조회(읽기 전용)
export const catalog = () => request<Catalog>("GET", base);
export const metadata = (table: string) =>
  request<TableMeta>("GET", tablePath(table));
export const rows = (table: string, params: Record<string, string>) =>
  request<Rows>(
    "GET",
    `${tablePath(table)}rows/?${new URLSearchParams(params)}`,
  );

// 공통데이터(리전·서비스·인력) 추가·수정·삭제
export type MasterKind = "regions" | "services" | "staff-members";
export const saveMaster = (
  kind: MasterKind,
  values: Record<string, unknown>,
  pk?: string | number,
) =>
  request(
    pk === undefined ? "POST" : "PATCH",
    `${base}common/${kind}/${pk === undefined ? "" : `${encodeURIComponent(pk)}/`}`,
    values,
  );
export const deleteMaster = (kind: MasterKind, pk: string | number) =>
  request("DELETE", `${base}common/${kind}/${encodeURIComponent(pk)}/`);
