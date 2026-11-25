import { errorMessage } from "../errors";
import type { ReportContent, ReportContext } from "../featureReport";

export interface Chapter extends ReportContent {
  id: string;
  label: string;
}

export async function loadReport(context: ReportContext): Promise<Chapter[]> {
  const chapters = await Promise.all(context.features.map(async ({ id, label, report }) => {
    if (!report) return null;
    try {
      const content = await report(context);
      return content && { id, label, ...content };
    } catch (cause) {
      throw new Error(`${label} 데이터 불러오기 실패 · ${errorMessage(cause)}`);
    }
  }));
  return chapters.filter((chapter): chapter is Chapter => chapter !== null);
}
