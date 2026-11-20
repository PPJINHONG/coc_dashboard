import type { Bootstrap, DataRow } from "./api/operations";

/** 표·입력 화면의 열 정의. 기능별 열 목록은 각 기능 폴더의 fields.ts에 둡니다. */
export interface Option {
  value: string;
  label: string;
}
export interface Field {
  key: string;
  label: string;
  type?: "number" | "textarea" | "select";
  options?: Option[];
  nullable?: boolean;
  /** 선택값을 숫자 ID로 저장합니다(리전·인력처럼 내부 숫자 PK로 연결하는 열). */
  numberValue?: boolean;
  max?: number;
  step?: string;
  default?: unknown;
}

export const choices = (items: Record<string, string>): Option[] =>
  Object.entries(items).map(([value, label]) => ({ value, label }));

/** 공통데이터를 참조하는 열. 여러 기능이 같은 리전·인력 원본을 씁니다. */
export const regionField = (data: Bootstrap): Field => ({
  key: "region",
  label: "리전",
  type: "select",
  numberValue: true,
  options: data.regions.map((r) => ({
    value: String(r.id),
    label: r.region_name,
  })),
});
export const staffMemberOptions = (data: Bootstrap): Option[] =>
  data.staff_members.map((s) => ({ value: String(s.id), label: s.staff_name }));
export const remarksField: Field = {
  key: "remarks",
  label: "비고",
  type: "textarea",
  default: "",
};

/** 화면에 보여 줄 셀 값. 선택 열은 이름, 숫자는 천 단위 구분으로 표시합니다. */
export function cell(row: DataRow, field: Field): string {
  const value = row[field.key];
  if (value === null || value === undefined || value === "")
    return field.nullable ? "미입력" : "—";
  if (field.options)
    return (
      field.options.find((o) => o.value === String(value))?.label ??
      String(value)
    );
  return field.type === "number"
    ? Number(value).toLocaleString("ko-KR")
    : String(value);
}

export function localDate(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}
/** 화면에 보이는 값 그대로 CSV로 내려받습니다. 파일 이름은 `날짜_name.csv`입니다. */
export function exportCsv(name: string, columns: Field[], rows: DataRow[]) {
  const escape = (text: string) =>
    `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  const content = [
    columns.map((field) => field.label),
    ...rows.map((row) => columns.map((field) => cell(row, field))),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${new Date().toISOString().slice(0, 10)}_${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
