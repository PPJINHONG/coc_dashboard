import { ApiError, getCookie, request } from "../../shared/api/client";

export type HandoverRegion = "KR" | "EU" | "NA";
export type HandoverPriority = "normal" | "high";
export type HandoverStatus = "in_progress" | "completed";
export type HandoverCategory = "issue" | "notice";

export interface HandoverImage {
  id: number;
  url: string;
  original_name: string;
}

export interface RegionalHandover {
  id: number;
  region: HandoverRegion;
  region_label: string;
  priority: HandoverPriority;
  priority_label: string;
  status: HandoverStatus;
  status_label: string;
  category: HandoverCategory;
  category_label: string;
  title: string;
  content_html: string;
  author_name: string;
  images: HandoverImage[];
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegionalHandoverInput {
  region: HandoverRegion;
  priority: HandoverPriority;
  status: HandoverStatus;
  category: HandoverCategory;
  title: string;
  content_html: string;
}

interface HandoverListResponse {
  revision: number;
  rows: RegionalHandover[];
}

const root = "/api/operations/regional_handovers";

export const listHandovers = () => request<HandoverListResponse>("GET", `${root}/`);
export const createHandover = (revision: number, values: RegionalHandoverInput) =>
  request<{ revision: number; row: RegionalHandover }>("POST", `${root}/`, { revision, ...values });
export const updateHandover = (id: number, revision: number, values: RegionalHandoverInput) =>
  request<{ revision: number; row: RegionalHandover }>("PATCH", `${root}/${id}/`, { revision, ...values });
export const deleteHandover = (id: number, revision: number) =>
  request<{ revision: number }>("DELETE", `${root}/${id}/`, { revision });

export async function uploadHandoverImage(file: File): Promise<HandoverImage> {
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
    throw new ApiError(
      response.status,
      fileErrors[0] || data?.detail || "이미지를 업로드할 수 없습니다.",
      { file: fileErrors },
    );
  }
  return data as HandoverImage;
}
