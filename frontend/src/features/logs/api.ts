import { request } from "../../shared/api/client";
import type { Log } from "../../shared/api/operations";

export interface HistoryRegion { id: number | string; region_name: string; country_code: string; }

export interface HistoryLog extends Log {
  actor_key: string;
  regions: HistoryRegion[];
  countries: string[];
  can_restore: boolean;
  restored: boolean;
  restore_reason: string;
}
export interface HistoryPage {
  results: HistoryLog[];
  count: number;
  next_offset: number | null;
  tabs: { id: string; count: number; latest_at: string }[];
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
