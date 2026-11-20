import { request } from "../../shared/api/client";
import type { Log } from "../../shared/api/operations";

export interface HistoryRegion { id: number | string; region_name: string; country_code: string; }

export interface HistoryLog extends Log {
  column_labels?: Record<string,string>;
  actor_key: string;
  regions: HistoryRegion[];
  countries: string[];
  can_restore: boolean;
  restored: boolean;
  restore_reason: string;
  /** 행별 변경 전·후 쌍. 권한 밖인 쪽은 null */
  changes?: { model: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }[];
}
export interface HistoryPage {
  results: HistoryLog[];
  count: number;
  next_offset: number | null;
  tabs: { id: string; count: number; latest_at: string }[];
  /** 작업 종류(create·update·delete·restore)별 건수 */
  actions: Record<string, number>;
  actors: { id: string; name: string }[];
  regions: HistoryRegion[];
}
export interface RestorePreview {
  token: string;
  revision: number;
  summary: string;
  affected_count: number;
  month: string | null;
}
export const history = (filters: Record<string, string>) => {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return request<HistoryPage>("GET", `/api/operations/logs/?${query}`);
};
export const previewRestore = (id: number) =>
  request<RestorePreview>("POST", `/api/db-admin/logs/${id}/restore-preview/`, {});
export const restore = (id: number, token: string) =>
  request("POST", `/api/db-admin/logs/${id}/restore/`, { token, confirmed: true });
