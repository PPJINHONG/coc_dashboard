import type { Snapshot } from "../shared/api/operations";
import Icon from "../shared/components/Icon";
import type { FeatureDefinition } from "../shared/feature";

export default function HomePage({
  snapshot,
  features,
  hiddenTabs,
  isAdmin,
  navigate,
}: {
  snapshot: Snapshot;
  features: FeatureDefinition[];
  hiddenTabs: string[];
  isAdmin: boolean;
  navigate: (tab: string) => void;
}) {
  const cards = features.filter((feature) =>
    (isAdmin || !feature.adminOnly) && feature.description &&
    feature.hideable !== false && !hiddenTabs.includes(feature.id),
  );

  return (
    <div className="home-page">
      <header className="home-heading">
        <h1>COC dashboard</h1>
        <p>인프라 자원과 운영 현황을 확인하고 필요한 기능으로 이동하세요.</p>
      </header>
      <section className="home-grid" aria-label="전체 기능">
        {cards.map((feature) => (
          <button
            key={feature.id}
            type="button"
            className="home-card"
            data-tone={feature.homeCard?.tone}
            aria-labelledby={`home-title-${feature.id}`}
            aria-describedby={`home-detail-${feature.id}`}
            onClick={() => navigate(feature.id)}
          >
            <span className="home-card-heading">
              <span className="home-card-title" id={`home-title-${feature.id}`}>{feature.label}</span>
              <Icon className="home-card-arrow" name="arrow" size={22} />
            </span>
            <span className="home-card-description" id={`home-detail-${feature.id}`}>{feature.description}</span>
            <span className="home-card-footer">
              <span className="home-card-count">{feature.homeCount?.(snapshot)}</span>
              {feature.homeCard ? (
                <span
                  aria-hidden="true"
                  className="home-card-logo"
                  style={{ maskImage: `url("${feature.homeCard.logo}")` }}
                />
              ) : <Icon className="home-card-logo-fallback" name={feature.icon} size={80} />}
            </span>
          </button>
        ))}
        {!cards.length && <p className="home-empty">표시된 기능이 없습니다.</p>}
      </section>
    </div>
  );
}
