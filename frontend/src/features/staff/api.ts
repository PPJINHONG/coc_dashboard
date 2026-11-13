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
  request(person.id ? "PATCH" : "POST", "/api/operations/staff/", { revision, person });

export interface Responsibility {
  country_code: string;
  site_representative: number | null;
  site_representative_name: string;
  team_lead: number | null;
  team_lead_name: string;
  group_lead: number | null;
  group_lead_name: string;
}
export interface StaffOptions {
  my_assignment: number | null;
  can_edit_calendar: boolean;
  can_view_grade: boolean;
  can_manage_choices: boolean;
  choices: StaffChoice[];
  accounts: { id: number; name: string; username: string }[];
  responsibilities: Responsibility[];
}
export interface StaffChoice { id: number; kind: "company_name" | "work_location"; country_code: string; value: string; }
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
export interface TrendMonth { month: string; entries: number; exits: number; headcount: number; net: number }
export interface StaffTrend { months: TrendMonth[]; missing_dates: number; grouping: string; companies: string[] }
const root = "/api/operations/staff";
export const staffOptions = () => request<StaffOptions>("GET", `${root}/options/`);
export const addStaffChoice = (revision: number, choice: Omit<StaffChoice, "id">) => request<{revision:number;choices:StaffChoice[]}>("POST", `${root}/choices/`, {revision,choice});
export const deleteStaffChoice = (revision: number, id: number) => request<{revision:number;choices:StaffChoice[]}>("DELETE", `${root}/choices/${id}/`, {revision});
export const calendarEvents = (month: string, country: string) => request<{ events: CalendarEvent[] }>("GET", `${root}/calendar/?${new URLSearchParams({ month, country })}`);
export const saveCalendarEvent = (revision: number, event: Partial<CalendarEvent>) => request(event.id ? "PATCH" : "POST", `${root}/calendar/${event.id ? `${event.id}/` : ""}`, { revision, event });
export const deleteCalendarEvent = (revision: number, id: number) => request("DELETE", `${root}/calendar/${id}/`, { revision });
export const saveResponsibility = (revision: number, responsibility: Partial<Responsibility>) => request("PUT", `${root}/responsibilities/`, { revision, responsibility });
export const staffTrend = (month: string, country: string, company: string) => request<StaffTrend>("GET", `${root}/trend/?${new URLSearchParams({ month, country, company })}`);
