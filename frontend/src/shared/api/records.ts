import { request } from "./client";

/** DB 관리 > 기능별 설정의 목록형 관리 화면(사용자·권한, 이슈 댓글 등)이 쓰는 행. */
export interface ManagedRecord extends Record<string, unknown> {
  id: number;
}

const base = "/api/db-admin/";
export const records = (collection: string) =>
  request<ManagedRecord[]>("GET", `${base}${collection}/`);
export const saveRecord = (
  collection: string,
  values: Record<string, unknown>,
  id?: number,
) =>
  request<ManagedRecord>(
    id ? "PATCH" : "POST",
    `${base}${collection}/${id ? `${id}/` : ""}`,
    values,
  );
export const deleteRecord = (collection: string, row: ManagedRecord, body?: unknown) =>
  request("DELETE", `${base}${collection}/${row.id}/`, body);
