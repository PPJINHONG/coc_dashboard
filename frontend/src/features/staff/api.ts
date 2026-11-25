import { request } from "../../shared/api/client";
import type { DataRow } from "../../shared/api/operations";

/**
 * 운영 인력 탭 편집 저장(관리자·팀장·그룹장). 편집 가능한 국가의 행 전체를 보내며,
 * 보낸 목록에서 빠진 그 국가 행은 삭제됩니다. 다른 국가 행은 바뀌지 않습니다.
 */
export const saveStaff = (revision: number, rows: DataRow[]) =>
  request<{ revision: number; rows: DataRow[] }>("PUT", "/api/operations/staff/", { revision, rows });

/** 한 사람만 등록·수정하며 다른 인력은 변경하거나 삭제하지 않습니다. */
export const saveStaffPerson = (revision: number, person: DataRow) =>
  request<{ revision: number; person: DataRow }>(person.id ? "PATCH" : "POST", "/api/operations/staff/", { revision, person });

export interface Responsibility {
  country_code: string;
  site_representative: number | null;
  site_representative_name: string;
  team_lead: number | null;
  team_lead_name: string;
  group_lead: number | null;
  group_lead_name: string;
  /** 권역 현지 출근·퇴근 시간(HH:MM:SS). 미등록이면 null이며 09:00~18:00으로 판정합니다. */
  work_start: string | null;
  work_end: string | null;
}
export interface StaffOptions {
  column_order: string[];
  my_assignment: number | null;
  can_edit_calendar: boolean;
  can_manage_choices: boolean;
  choices: StaffChoice[];
  items: StaffItem[];
  accounts: { id: number; name: string; username: string; email: string }[];
  responsibilities: Responsibility[];
}
export interface StaffChoice { id: number; kind: string; value: string; }
export interface StaffItemValue { value:string; choice_id:number|null; uses:number; }
export interface StaffItem { allow_free_text: boolean; key:string; label:string; custom:boolean; column_id?:number; position?:number; values:StaffItemValue[]; }
export interface StaffItemResult { column_order: string[]; revision:number; choices:StaffChoice[]; items:StaffItem[]; }
export interface CalendarEvent {
  id: number;
  assignment: number;
  staff_name: string;
  country_code: string;
  kind: string;
  title: string;
  start_date: string;
  end_date: string;
  can_edit: boolean;
}
export interface TrendMonth {
  month: string;
  hires: number;
  resignations: number;
  deployments: number;
  assignment_ends: number;
  headcount: number;
  recorded: boolean;
  future: boolean;
}
export interface StaffTrend { months: TrendMonth[]; missing_dates: number; companies: string[] }

const root = "/api/operations/staff";
export const staffOptions = () => request<StaffOptions>("GET", `${root}/options/`);
export const addStaffChoice = (revision: number, choice: Omit<StaffChoice, "id">) => request<StaffItemResult>("POST", `${root}/choices/`, {revision,choice});
export const deleteStaffChoice = (revision: number, id: number) => request<StaffItemResult>("DELETE", `${root}/choices/${id}/`, {revision});
export const addStaffColumn = (revision:number, label:string, allowFreeText:boolean) => request<StaffItemResult & {column:{key:string;label:string;position:number}}>("POST", `${root}/columns/`, {revision,label,allow_free_text:allowFreeText});
export const setStaffFreeText = (revision: number, key: string, enabled: boolean) =>
  request<StaffItemResult>("PATCH", `${root}/columns/${encodeURIComponent(key)}/`, { revision, allow_free_text: enabled });
export const reorderStaffColumns = (revision:number, keys:string[]) => request<StaffItemResult>("PUT", `${root}/columns/`, {revision,keys});
export const deleteStaffColumn = (revision:number, key:string) => request<StaffItemResult>("DELETE", `${root}/columns/${encodeURIComponent(key)}/`, {revision});
export const calendarEvents = (month: string, country: string) => request<{ events: CalendarEvent[] }>("GET", `${root}/calendar/?${new URLSearchParams({ month, country })}`);
export const saveCalendarEvent = (revision: number, event: Partial<CalendarEvent>) => request(event.id ? "PATCH" : "POST", `${root}/calendar/${event.id ? `${event.id}/` : ""}`, { revision, event });
export const deleteCalendarEvent = (revision: number, id: number) => request("DELETE", `${root}/calendar/${id}/`, { revision });
export const saveResponsibility = (revision: number, responsibility: Partial<Responsibility>) => request("PUT", `${root}/responsibilities/`, { revision, responsibility });
export const staffTrend = (month: string, country: string, company: string) => request<StaffTrend>("GET", `${root}/trend/?${new URLSearchParams({ month, country, company })}`);
