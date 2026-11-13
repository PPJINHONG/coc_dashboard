import { request } from "../../shared/api/client";

export interface Member {
  id: number;
  name: string;
  username: string;
  role: string;
  managed_countries: string[];
  is_active: boolean;
  is_online: boolean;
  active_sessions: number;
  last_login: string | null;
  last_activity: string | null;
  date_joined: string;
  can_edit: boolean;
}
export interface MemberList {
  accounts: Member[];
  assignable_roles: { value: string; label: string }[];
}
export const getMembers = () => request<MemberList>("GET", "/api/members/");
export const saveMember = (id: number | undefined, values: Record<string, unknown>) =>
  request<Member>(id ? "PATCH" : "POST", `/api/members/${id ? `${id}/` : ""}`, values);
