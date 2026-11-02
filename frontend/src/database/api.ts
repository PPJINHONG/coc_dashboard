import { request } from "../api/client";

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
export interface Change {
  id: number;
  action: string;
  table_name: string;
  actor_username: string;
  details: unknown;
  sql_text: string;
  created_at: string;
}
const base = "/api/db-admin/";
const tablePath = (table: string) =>
  `${base}tables/${encodeURIComponent(table)}/`;
export const catalog = () => request<Catalog>("GET", base);
export const metadata = (table: string) =>
  request<TableMeta>("GET", tablePath(table));
export const rows = (table: string, params: Record<string, string>) =>
  request<Rows>(
    "GET",
    `${tablePath(table)}rows/?${new URLSearchParams(params)}`,
  );
export const changes = () => request<Change[]>("GET", `${base}changes/`);

export interface ManagedRecord extends Record<string, unknown> {
  id: number;
}
export type Collection = "accounts" | "comments";
export const records = (collection: Collection) =>
  request<ManagedRecord[]>("GET", `${base}${collection}/`);
export const saveRecord = (
  collection: Collection,
  values: Record<string, unknown>,
  id?: number,
) =>
  request<ManagedRecord>(
    id ? "PATCH" : "POST",
    `${base}${collection}/${id ? `${id}/` : ""}`,
    values,
  );
export const deleteRecord = (collection: Collection, row: ManagedRecord) =>
  request(
    "DELETE",
    `${base}${collection}/${row.id}/`,
    collection === "accounts" ? { confirm_username: row.username } : undefined,
  );

export interface Activity {
  id: number;
  action: "login" | "logout" | "login_failed" | "create" | "update" | "delete" | string;
  target_type: string;
  target_id: string;
  summary: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  changes: Record<string, { before: unknown; after: unknown }>;
  ip_address: string | null;
  created_at: string;
}
export const accountActivities = (id: number) =>
  request<{ account: ManagedRecord; activities: Activity[] }>(
    "GET",
    `${base}accounts/${id}/activities/`,
  );
