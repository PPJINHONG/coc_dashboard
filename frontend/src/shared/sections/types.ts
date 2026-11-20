import type { ComponentType } from "react";
import type { Bootstrap, DataRow } from "../api/operations";
import type { Field } from "../fields";

/**
 * 현재값 목록 기능의 화면 설정.
 * 일반 조회 화면(SectionPage)이 필터·요약·표 구성을 공유할 때 씁니다.
 */
export interface SectionConfig {
  /** API 이름. 기능 ID·백엔드 Section.key와 같습니다(예: staff). */
  key: string;
  /** 화면 제목 */
  label: string;
  fields: (data: Bootstrap) => Field[];
  /** 첫 번째 필터에 쓰는 열(region 또는 country_code) */
  filterKey: string;
  searchPlaceholder: string;
  /** 상태 필터를 보여 줍니다. */
  statusFilter?: boolean;
  /** 화면 바깥 상자에 더할 클래스(앞에 공백 포함, 예: " staff-page") */
  pageClassName?: string;
  /** 일반 화면 표 패널의 부제 */
  viewSubtitle?: string;
  /** 표. 없으면 화면이 직접 본문을 그립니다. */
  Table?: ComponentType<{ rows: DataRow[]; data: Bootstrap }>;
}
