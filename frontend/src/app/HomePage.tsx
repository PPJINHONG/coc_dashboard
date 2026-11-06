import type { Bootstrap, Snapshot } from "../shared/api/operations";
import Icon from "../shared/components/Icon";
import type { FeatureDefinition } from "../shared/feature";

/**
 * 홈: 주요 기능(feature.tsx의 featured)과 전체 기능 카드(description이 있는 기능).
 * 숨길 수 없는 관리자 기능(DB 관리)은 마지막에 "관리자 전용" 카드로 둡니다.
 */
export default function HomePage({
  data,
  snapshot,
  features,
  hiddenTabs,
  isAdmin,
  navigate,
  manageTabs,
}: {
  data: Bootstrap;
  snapshot: Snapshot;
  features: FeatureDefinition[];
  hiddenTabs: string[];
  isAdmin: boolean;
  navigate: (tab: string) => void;
  manageTabs: () => void;
}) {
  const accessible = features.filter((feature) => isAdmin || !feature.adminOnly);
  const cards = accessible.filter(
    (feature) => feature.description && feature.hideable !== false && !hiddenTabs.includes(feature.id),
  );
  const adminCards = accessible.filter((feature) => feature.description && feature.hideable === false);
  const featured = cards
    .filter((feature) => feature.featured)
    .sort((a, b) => a.featured!.order - b.featured!.order);
  return (
    <div className="home-page">
      <header className="home-heading">
        <h1>COC dashboard</h1>
        <p>인프라 자원과 운영 현황을 확인하고 필요한 기능으로 이동하세요.</p>
      </header>
      {featured.length > 0 && (
        <section className="featured-section" aria-label="주요 기능">
          <h2>주요 기능</h2>
          <div className={`featured-grid featured-count-${featured.length}`}>
            {featured.map((feature) => {
              const Preview = feature.featured!.Preview;
              return (
                <button
                  key={feature.id}
                  className={`feature-card featured-card${feature.featured!.wide ? " featured-card-wide" : ""}`}
                  data-feature={feature.id}
                  onClick={() => navigate(feature.id)}
                >
                  <div className={`featured-art featured-art-${feature.id}`} aria-hidden="true">
                    <Preview data={data} snapshot={snapshot} />
                  </div>
                  <div className="featured-copy">
                    <span className="feature-icon"><Icon name={feature.icon} size={20} /></span>
                    <h3>{feature.label}</h3>
                    <p>{feature.description}</p>
                  </div>
                  <div className="feature-card-bottom">
                    <span>{feature.homeCount?.(snapshot)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <section className="home-directory" aria-label="전체 기능">
        <div className="directory-heading">
          <h2>
            전체 기능 <span>{cards.length}</span>
          </h2>
          <button className="btn btn-sm" onClick={manageTabs}>
            <Icon name="eye" size={14} />탭 관리
          </button>
        </div>
        <div className="feature-grid">
          {cards.map((feature) => (
            <button
              key={feature.id}
              className="feature-card"
              data-feature={feature.id}
              onClick={() => navigate(feature.id)}
            >
              <span className="feature-icon"><Icon name={feature.icon} size={20} /></span>
              <div>
                <h3>{feature.label}</h3>
                <p>{feature.description}</p>
              </div>
              <div className="feature-card-bottom">
                <span>{feature.homeCount?.(snapshot)}</span>
              </div>
            </button>
          ))}
          {adminCards.map((feature) => (
            <button
              key={feature.id}
              className="feature-card"
              data-feature={feature.id}
              onClick={() => navigate(feature.id)}
            >
              <span className="feature-icon"><Icon name={feature.icon} size={20} /></span>
              <div>
                <h3>{feature.label}</h3>
                <p>{feature.description}</p>
              </div>
              <div className="feature-card-bottom">
                <span className="subtle-badge">관리자 전용</span>
                <span>{feature.homeCount?.(snapshot)}</span>
              </div>
            </button>
          ))}
        </div>
        {!cards.length && (
          <div className="empty-state">
            <h3>표시된 기능이 없습니다.</h3>
            <p>탭 관리에서 다시 표시할 기능을 선택하세요.</p>
            <button className="btn btn-sm" onClick={manageTabs}>
              탭 관리
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
