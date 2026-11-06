import type { FeatureDefinition } from "../shared/feature";

/**
 * features/<기능>/feature.tsx를 자동으로 모읍니다. 새 기능은 폴더와 feature.tsx만 추가하면
 * 사이드바·홈·탭 관리·리포트·DB 관리에 나타나므로 이 파일과 공통 화면(app/)을 고치지 않습니다.
 * 기능 ID는 폴더 이름과 같게 둡니다.
 */
const modules = import.meta.glob<{ default: FeatureDefinition }>("./*/feature.tsx", { eager: true });

const seen = new Set<string>();
export const FEATURES: FeatureDefinition[] = Object.entries(modules)
  .flatMap(([path, module]) => {
    const feature = module.default;
    const folder = path.split("/")[1];
    if (feature.id !== folder)
      console.error(`기능 ID(${feature.id})와 폴더 이름(${folder})이 다릅니다.`);
    if (seen.has(feature.id)) {
      console.error(`같은 기능 ID(${feature.id})가 두 번 등록되어 뒤의 것을 무시합니다.`);
      return [];
    }
    seen.add(feature.id);
    return [feature];
  })
  .sort((a, b) => a.order - b.order);
