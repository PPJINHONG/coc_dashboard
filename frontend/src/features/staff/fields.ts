import type { Field } from "../../shared/fields";

export const REGIONS = { KR: "내수", EU: "유럽", NA: "북미" } as const;

export function staffFields(countries: readonly string[] = Object.keys(REGIONS)): Field[] {
  const options = Object.entries(REGIONS)
    .filter(([code]) => countries.includes(code))
    .map(([value, label]) => ({ value, label: `${value} · ${label}` }));
  return [
    { key: "staff_name", label: "이름" },
    { key: "country_code", label: "리전", type: "select", options, default: options[0]?.value },
  ];
}

export const WORK_STATUSES = [
  { value: "on_duty", label: "출근" },
  { value: "off_duty", label: "퇴근" },
  { value: "leave", label: "휴가" },
  { value: "planned", label: "투입 예정" },
  { value: "retired", label: "퇴사" },
];
