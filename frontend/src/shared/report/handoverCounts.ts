import type { ReportEntry } from "../featureReport";

export function countEntries(entries: ReportEntry[]) {
  const count = (label: string, value: string) =>
    entries.filter((entry) => entry.facts.some(([key, text]) => key === label && text === value)).length;
  return {
    total: entries.length,
    active: count("상태", "진행 중"),
    complete: count("상태", "완료"),
    important: count("우선순위", "중요"),
    issues: count("분류", "이슈"),
    notices: count("분류", "공지"),
  };
}
