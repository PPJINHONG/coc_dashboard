import { request } from "../../shared/api/client";
import type { DataRow } from "../../shared/api/operations";

export const RESOURCE_SERVICES = ["HCLOUD", "CCS"] as const;
export type ResourceService = (typeof RESOURCE_SERVICES)[number];

export interface ResourceInput {
  region: number;
  service: ResourceService;
  host_count: number;
  vm_count: number | null;
  compute_rack_count: number | null;
  storage_count: number | null;
  remarks: string;
}

export interface ResourceSaveResponse {
  revision: number;
  row: DataRow;
}

const root = "/api/operations/resources";

export const createResource = (
  revision: number,
  month: string,
  values: ResourceInput,
) =>
  request<ResourceSaveResponse>("POST", `${root}/`, {
    revision,
    month,
    ...values,
  });

export const updateResource = (
  id: number,
  revision: number,
  month: string,
  values: ResourceInput,
) =>
  request<ResourceSaveResponse>("PATCH", `${root}/${id}/`, {
    revision,
    month,
    ...values,
  });

export const deleteResource = (id: number, revision: number, month: string) =>
  request<{ revision: number }>("DELETE", `${root}/${id}/`, {
    revision,
    month,
  });
