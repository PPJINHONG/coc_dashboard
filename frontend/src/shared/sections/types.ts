import type { ComponentType } from "react";
import type { Bootstrap, DataRow } from "../api/operations";
import type { Field } from "../fields";

/**
 * 현재값 목록 기능(운영 인력·운영 작업 등)의 화면 설정.
 * 일반 조회 화면(SectionPage)과 DB 관리 편집 화면(SectionEditor)이 같은 설정을 씁니다.
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
  /** 상태 필터를 보여 줍니다(리전 이슈). */
  statusFilter?: boolean;
  /** 화면 바깥 상자에 더할 클래스(앞에 공백 포함, 예: " staff-page") */
  pageClassName?: string;
  /** 일반 화면 표 패널의 부제 */
  viewSubtitle?: string;
  /** 목록 위 요약(운영 작업의 완료율 카드) */
  Summary?: ComponentType<{ rows: DataRow[] }>;
  /** 표. 없으면 리전 이슈처럼 화면이 직접 본문을 그립니다. */
  Table?: ComponentType<{ rows: DataRow[]; data: Bootstrap }>;
  /** DB 관리 편집 패널 안내 문구 */
  editorHint: string;
  /** 편집 화면의 행 추가 버튼 문구. 기본 "+ 행 추가" */
  addLabel?: string;
  /** 편집 화면 모양. 기본 표(table), 리전 이슈는 카드(cards) */
  editLayout?: "table" | "cards";
  /** 행 복사 때 비울 열(예: 같은 인력을 두 번 배치하지 않도록 성명) */
  copyReset?: string[];
  /** 편집 중 값이 바뀌면 함께 바꿀 값(예: 완료 상태면 진행률 100) */
  onFieldChange?: (key: string, value: unknown) => DataRow;
}
