import { reportTime, type ReportSource } from "../../shared/featureReport";
import { listNotices } from "./api";

export const noticeReport: ReportSource = async ({ snapshot }) => {
  const notices = await listNotices(snapshot.month);
  return {
    scope: "작업 예정일 기준 · 한국 시간(KST)",
    timeline: notices.sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at) || a.id - b.id)
      .map((row) => ({
        category: row.category, content: row.content,
        id: row.id, at: reportTime(row.scheduled_at), title: row.title, region: row.country_code || row.region_name,
      })),
  };
};
