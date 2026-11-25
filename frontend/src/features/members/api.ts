import { request } from "../../shared/api/client";

export interface Member {
  id: number;
  name: string;
  username: string;
  email: string;
  role: "admin" | "user";
  is_active: boolean;
  is_online: boolean;
  active_sessions: number;
  last_login: string | null;
  last_activity: string | null;
  date_joined: string;
  can_edit: boolean;
  must_change_password: boolean;
}
export interface MemberList {
  accounts: Member[];
  assignable_roles: { value: "admin" | "user"; label: string }[];
}
export const getMembers = () => request<MemberList>("GET", "/api/members/");
export const saveMember = (id: number | undefined, values: Record<string, unknown>) =>
  request<Member>(id ? "PATCH" : "POST", `/api/members/${id ? `${id}/` : ""}`, values);
export const resetMemberPassword = (id: number) =>
  request<{ id: number; must_change_password: boolean }>("POST", `/api/members/${id}/reset-password/`, {});
