import type { Bootstrap, DataRow } from "../../shared/api/operations";

export const metrics = [
  { key: "host_count", label: "Host", unit: "대" },
  { key: "vm_count", label: "VM", unit: "대" },
  { key: "compute_rack_count", label: "Compute Rack", unit: "개" },
  { key: "storage_count", label: "Storage Rack", unit: "개" },
] as const;

export const trendMetrics = [...metrics, { key: "rack", label: "전체 Rack", unit: "개" }] as const;
export type Quantity = typeof trendMetrics[number]["key"];
export type Amount = { value: number | null; incomplete: boolean };
export const formatCount = (value: number) => value.toLocaleString("ko-KR");
export const areaCode = (country?: string) => country === "CN" ? "KR" : country || "기타";
export const mainAreas = ["KR", "NA", "EU"];
export function areaOrder(codes: string[]) {
  return [...new Set([...mainAreas, ...codes])];
}

export function measure(rows: DataRow[], key: Quantity): Amount {
  if (key === "rack") {
    const compute = measure(rows, "compute_rack_count");
    const storage = measure(rows, "storage_count");
    return {
      value: compute.value === null && storage.value === null ? null : (compute.value ?? 0) + (storage.value ?? 0),
      incomplete: compute.incomplete || storage.incomplete,
    };
  }
  let total = 0, known = 0;
  for (const row of rows) {
    if (row[key] == null) continue;
    known++;
    total += Number(row[key]);
  }
  return { value: known ? total : null, incomplete: known < rows.length };
}

export function amountText(amount: Amount) {
  if (amount.value === null) return amount.incomplete ? "미입력" : "미등록";
  return formatCount(amount.value) + (amount.incomplete ? " + 미입력" : "");
}

export function locations(rows: DataRow[], data: Bootstrap) {
  const regions = new Map(data.regions.map((region) => [region.id, region]));
  const grouped = new Map<DataRow["region"], DataRow[]>();
  for (const row of rows) {
    const items = grouped.get(row.region);
    if (items) items.push(row);
    else grouped.set(row.region, [row]);
  }
  return [...grouped].map(([id, items]) => {
    const region = id == null ? undefined : regions.get(id);
    return { id, name: region?.region_name ?? "미등록 리전", area: areaCode(region?.country_code), rows: items };
  }).sort((a, b) => (measure(b.rows, "host_count").value ?? 0) - (measure(a.rows, "host_count").value ?? 0)
    || a.name.localeCompare(b.name, "ko"));
}

export const signed = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatCount(Math.abs(value))}`;

export function difference(now: Amount, previous: Amount) {
  if (now.value === null || previous.value === null || now.incomplete || previous.incomplete) return null;
  return now.value - previous.value;
}
