import type { ComponentType } from "react";
import type { User } from "./api/auth";
import type { Bootstrap, Snapshot } from "./api/operations";
import type { IconName } from "./components/Icon";

/** 공통 뼈대(app/AppShell.tsx)가 기능 화면(Page)에 넘겨 주는 값 */
export interface FeaturePageProps {
  data: Bootstrap;
  snapshot: Snapshot;
  user: User | null;
  /** 등록된 전체 기능. 리포트·DB 관리처럼 다른 기능을 모아 보여 줄 때 씁니다. 다른 기능 폴더를 직접 import하지 않습니다. */
  features: FeatureDefinition[];
  navigate: (tab: string) => void;
  /** 공통데이터와 현재값을 다시 불러옵니다. */
  refresh: () => Promise<void>;
  /** 저장하지 않은 편집이 있으면 true. 다른 탭으로 이동할 때 확인 창을 띄웁니다. */
  setDirty: (dirty: boolean) => void;
  /** 저장 중이면 true. 그동안 이동 버튼을 막습니다. */
  setBusy: (busy: boolean) => void;
}

/** 홈 카드·리포트 칸이 받는 값 */
export interface FeatureDataProps {
  data: Bootstrap;
  snapshot: Snapshot;
}

/** DB 관리 > 기능별 설정의 하위 탭이 받는 값 */
export interface AdminTabProps {
  data: Bootstrap;
  snapshot: Snapshot;
  onChanged: () => Promise<void>;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
}

export interface AdminTab {
  id: string;
  label: string;
  Editor: ComponentType<AdminTabProps>;
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
  /** 홈 "주요 기능"에 넣을 때 순서·넓은 카드 여부·미리보기 */
  featured?: { order: number; wide?: boolean; Preview: ComponentType<FeatureDataProps> };
  /** 리포트 화면에 넣을 때 순서와 요약 화면 */
  report?: { order: number; Summary: ComponentType<FeatureDataProps> };
  /** DB 관리 > 기능별 설정에 추가할 하위 탭 */
  admin?: AdminTab[];
  Page: ComponentType<FeaturePageProps>;
}
