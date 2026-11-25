import type { ComponentType } from "react";
import type { User } from "./api/auth";
import type { Bootstrap, Snapshot } from "./api/operations";
import type { IconName } from "./components/Icon";
import type { ReportSource } from "./featureReport";

/** 공통 뼈대(app/AppShell.tsx)가 기능 화면(Page)에 넘겨 주는 값 */
export interface FeaturePageProps {
  data: Bootstrap;
  snapshot: Snapshot;
  user: User | null;
  /** 등록된 전체 기능. 변경 이력처럼 기능 목록을 모아 보여 줄 때 씁니다. 다른 기능 폴더를 직접 import하지 않습니다. */
  features: FeatureDefinition[];
  navigate: (tab: string, view?: string) => void;
  /** 공통데이터와 현재값을 다시 불러옵니다. */
  refresh: () => Promise<void>;
  /** 저장하지 않은 편집이 있으면 true. 다른 탭으로 이동할 때 확인 창을 띄웁니다. */
  setDirty: (dirty: boolean) => void;
  /** 저장 중이면 true. 그동안 이동 버튼을 막습니다. */
  setBusy: (busy: boolean) => void;
}

/**
 * 기능 하나의 화면 등록 정보. features/<id>/feature.tsx가 default export합니다.
 * features/registry.ts가 자동으로 모으므로 공통 파일에 기능을 나열하지 않습니다.
 */
export interface FeatureDefinition {
  /** 탭 ID. 폴더 이름, 주소(#tab=), 백엔드 feature.py의 tabs·sections 이름과 같게 둡니다. */
  id: string;
  label: string;
  icon: IconName;
  /** 사이드바·홈·탭 관리 순서. 작을수록 앞입니다. */
  order: number;
  /** 관리자에게만 보입니다(사이드바의 관리자 메뉴). */
  adminOnly?: boolean;
  /** 지정된 계정 역할만 이 기능에 접근합니다. */
  allowedRoles?: NonNullable<User["role"]>[];
  /** 관리자 또는 팀장용 관리 메뉴에 배치합니다. 접근 권한은 allowedRoles로 지정합니다. */
  management?: boolean;
  /** false면 탭 관리에서 숨길 수 없습니다. 기본 true. 숨길 수 있는 탭은 백엔드 feature.py tabs에도 적습니다. */
  hideable?: boolean;
  /** 홈 카드·탭 관리·화면 위에 쓰는 영문 이름 */
  english?: string;
  /** 홈 카드 설명. 없으면 홈 카드를 만들지 않습니다. */
  description?: string;
  /** 홈 카드 아래 건수 문구 */
  homeCount?: (snapshot: Snapshot) => string;
  /** 이 기능이 월간 리포트에 제공하는 조회 전용 데이터. */
  report?: ReportSource;
  /** 홈 카드에서 사용하는 기능 고유 로고와 배경색. */
  homeCard?: { logo: string; tone: "navy" | "mist" | "forest" | "wine" | "sage" | "ink" | "paper" };
  /** 활성 기능 아래 사이드 탭. 기본 화면은 id를 빈 문자열로 등록합니다. */
  subpages?: { id: string; label: string; Page: ComponentType<FeaturePageProps> }[];
  Page: ComponentType<FeaturePageProps>;
}
