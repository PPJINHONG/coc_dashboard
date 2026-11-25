import { sectionRows } from "../../shared/api/operations";
import type { ReportSource } from "../../shared/featureReport";
import { difference, formatCount, locations, measure, metrics, trendMetrics } from "./resourceMetrics";
import { loadResourceHistory, monthAt } from "./useResourceHistory";

export const resourceReport: ReportSource = async ({ data, snapshot }) => {
  const current = sectionRows(snapshot, "resources");
  const lastYear = monthAt(snapshot.month, -12);
  const [history, baseline] = await Promise.all([
    loadResourceHistory(snapshot.month, 12), loadResourceHistory(lastYear, 1),
  ]);
  const year = Array.from({ length: 12 }, (_, i) => monthAt(snapshot.month, i - 11));
  const sites = locations(current, data);

  return {
    scope: "기준 월 전체 자원 수량과 최근 12개월 추이",
    resourceRegionCount: sites.length,
    trends: { months: year, series: trendMetrics.map(({ key, label }) => ({
      label,
      values: year.map((month) => {
        const amount = measure(month === snapshot.month ? current : history[month] ?? [], key);
        return amount.incomplete ? null : amount.value;
      }),
      annualChange: difference(measure(current, key), measure(baseline[lastYear] ?? [], key)),
    })) },
    figures: trendMetrics.map(({ key, label, unit }) => ({ label, unit, ...measure(current, key) })),
    tables: [{
      title: "리전·서비스별 자원",
      columns: ["리전", "서비스", ...metrics.map((metric) => metric.label), "비고"],
      numeric: [2, 3, 4, 5],
      rows: sites.flatMap((site) => site.rows.map((row) => [
        site.name, String(row.service), ...metrics.map(({ key }) =>
          row[key] == null ? "미입력" : formatCount(Number(row[key]))), String(row.remarks || "—"),
      ])),
    }],
  };
};
