import type { Bootstrap } from "./api";

// Audit records stay intact in the DB. Only their visible representation uses names.
export function logDisplay(value: unknown, section: string, data: Bootstrap): unknown {
  if (Array.isArray(value)) return value.map((item) => logDisplay(item, section, data));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (["region_code", "staff_code"].includes(key)) return [];
    if (key === "id" && ["regions", "staff-members"].includes(section)) return [];
    if (["region", "region_id"].includes(key)) {
      return [[key, data.regions.find((region) => region.id === item)?.region_name ?? "이전 리전"]];
    }
    if (["staff", "staff_member_id", "owner", "owner_staff_id"].includes(key)) {
      return [[key, item == null ? "미지정" : data.staff_members.find((staff) => staff.id === item)?.staff_name ?? "이전 인력"]];
    }
    return [[key, logDisplay(item, section, data)]];
  }));
}
