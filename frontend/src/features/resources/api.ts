import { request } from "../../shared/api/client";
import type { DataRow } from "../../shared/api/operations";

export interface ResourceInput {
  region: number;
  service: string;
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
