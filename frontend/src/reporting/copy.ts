import type { Bootstrap, DataRow, MasterKind, Section } from "./api";
import { fields } from "./config";

export function copySectionRow(
  section: Section,
  row: DataRow,
  data: Bootstrap,
): DataRow {
  // Only editable values are copied: IDs, timestamps and existing comments stay with the source.
  const copy = Object.fromEntries(
    fields(section, data).map((field) => [
      field.key,
      structuredClone(row[field.key] ?? field.default ?? null),
    ]),
  ) as DataRow;
  if (section === "staff") copy.staff = "";
  return copy;
}

export function copyCommonRow(kind: MasterKind, row: Record<string, unknown>) {
  if (kind === "staff-members") return { staff_name: row.staff_name };
  const copy = { ...row };
  delete copy.id;
  if (kind === "services") copy.service_code = "";
  const name = kind === "regions" ? "region_name" : "service_name";
  copy[name] = `${String(row[name]).slice(0, 75)} (복사)`;
  return copy;
}
