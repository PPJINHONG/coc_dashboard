import type { ReportSource } from "../../shared/featureReport";
import { listHandovers } from "./api";

export const handoverReport: ReportSource = async ({ user }) => {
  if (!user) return null;
  const { rows } = await listHandovers();
  return {
    scope: "조회 시점의 전체 핸드오버",
    entries: rows.map((row) => ({
      id: row.id,
      region: row.region,
      title: row.title,
      content: row.content_html,
      richText: true,
      facts: [
        ["권역", row.region], ["상태", row.status_label],
        ["우선순위", row.priority_label], ["분류", row.category_label],
      ],
    })),
  };
};
