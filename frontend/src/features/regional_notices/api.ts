import type { ScheduleRegion } from "../../shared/regionalTime";
import { request } from "../../shared/api/client";

export type NoticeCountry = ScheduleRegion;

export interface RegionalNotice {
  id: number;
  month: string;
  region: number | null;
  region_name: string;
  country_code: NoticeCountry;
  scheduled_at: string;
  title: string;
  content: string;
  category: string;
  author: string;
  can_edit: boolean;
  updated_at: string;
}

export interface RegionalNoticeInput {
  country_code: NoticeCountry;
  scheduled_local: string;
  title: string;
  content: string;
  category: string;
}

const root = "/api/operations/regional_notices";

export const listNotices = (month: string) =>
  request<RegionalNotice[]>("GET", `${root}/?month=${encodeURIComponent(month)}`);

export const createNotice = (revision: number, values: RegionalNoticeInput) =>
  request<{ revision: number; row: RegionalNotice }>("POST", `${root}/`, { revision, ...values });

export const updateNotice = (id: number, revision: number, values: RegionalNoticeInput) =>
  request<{ revision: number; row: RegionalNotice }>("PATCH", `${root}/${id}/`, { revision, ...values });

export const deleteNotice = (id: number, revision: number) =>
  request<{ revision: number }>("DELETE", `${root}/${id}/`, { revision });
