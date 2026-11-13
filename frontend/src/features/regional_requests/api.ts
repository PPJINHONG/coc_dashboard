import { ApiError, getCookie, request } from "../../shared/api/client";

export type RequestStatus = "open" | "in_progress" | "completed";
export type ScheduleTimezone = "UTC" | "KST" | "CET";
export type AssigneeRegion = "KR" | "NA" | "EU";

export interface RequestImage {
  id: number;
  url: string;
  original_name: string;
}

export interface RegionalRequest {
  id: number;
  month: string;
  region: AssigneeRegion;
  region_name: string;
  title: string;
  content_html: string;
  requester: string;
  requested_at: string;
  schedule_timezone: ScheduleTimezone;
  timezone_label: string;
  schedule_start: string;
  schedule_end: string;
  schedule_start_display: string;
  schedule_end_display: string;
  status: RequestStatus;
  status_label: string;
  assignee_regions: AssigneeRegion[];
  assignee_name: string;
  author_name: string;
  images: RequestImage[];
  can_edit_content: boolean;
  can_update_assignment: boolean;
  can_delete: boolean;
  updated_at: string;
}

export interface RegionalRequestInput {
  region: AssigneeRegion;
  title: string;
  content_html: string;
  requester: string;
  schedule_timezone: ScheduleTimezone;
  schedule_start_local: string;
  schedule_end_local: string;
  status: RequestStatus;
  assignee_regions: AssigneeRegion[];
  assignee_name: string;
}

const root = "/api/operations/regional_requests";

export const listRequests = (month: string, region?: AssigneeRegion) =>
  request<RegionalRequest[]>(
    "GET",
    `${root}/?month=${encodeURIComponent(month)}${region ? `&region=${region}` : ""}`,
  );
export const getRequest = (id: number) => request<RegionalRequest>("GET", `${root}/${id}/`);
export const createRequest = (values: RegionalRequestInput) =>
  request<{ revision: number; row: RegionalRequest }>("POST", `${root}/`, values);
export const updateRequest = (id: number, values: Partial<RegionalRequestInput>) =>
  request<{ revision: number; row: RegionalRequest }>("PATCH", `${root}/${id}/`, values);
export const deleteRequest = (id: number) =>
  request<{ revision: number }>("DELETE", `${root}/${id}/`);

export async function uploadImage(file: File): Promise<RequestImage> {
  let token = getCookie("csrftoken");
  if (!token) {
    await fetch("/api/auth/csrf/", { credentials: "include" });
    token = getCookie("csrftoken");
  }
  const body = new FormData();
  body.append("file", file);
  let response: Response;
  try {
    response = await fetch(`${root}/images/`, {
      method: "POST",
      credentials: "include",
      headers: token ? { "X-CSRFToken": token } : undefined,
      body,
    });
  } catch {
    throw new ApiError(0, "이미지를 업로드할 수 없습니다.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fileErrors = data && Array.isArray(data.file) ? data.file : [];
    throw new ApiError(response.status, fileErrors[0] || data?.detail || "이미지를 업로드할 수 없습니다.", { file: fileErrors });
  }
  return data as RequestImage;
}
