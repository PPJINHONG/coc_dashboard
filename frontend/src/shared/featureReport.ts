import type { FeaturePageProps } from "./feature";
import { regionalInput } from "./regionalTime";

export type ReportContext = Pick<FeaturePageProps, "data" | "snapshot" | "user" | "features">;

export interface ReportTable {
  title?: string;
  columns: string[];
  numeric?: number[];
  rows: (string | number)[][];
  note?: string;
}

export interface ReportEntry {
  region: string;
  id: number;
  title: string;
  facts: [string, string][];
  content: string;
  /** 요청작업·핸드오버 API에서 허용 태그와 첨부 이미지 주소를 검증한 본문. */
  richText?: boolean;
}

export interface ReportFigure {
  label: string;
  value: number | null;
  unit: string;
  incomplete?: boolean;
}

export interface ReportContent {
  scope: string;
  tables?: ReportTable[];
  requests?: { month: string; previous: string; regions: { region: string; now: number; prior: number }[] };
  trends?: { months: string[]; series: { label: string; values: (number | null)[]; annualChange: number | null }[] };
  resourceRegionCount?: number;
  entries?: ReportEntry[];
  timeline?: { id: number; at: string; title: string; region: string; category: string; content: string }[];
  figures?: ReportFigure[];
}

export type ReportSource = (context: ReportContext) =>
  ReportContent | null | Promise<ReportContent | null>;

export const reportTime = (value: string) => regionalInput(value, "KR").replace("T", " ");
