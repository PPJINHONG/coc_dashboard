import { useEffect, useRef, type ReactNode } from "react";
import type { Bootstrap, DataRow } from "./api";

function ChartScroll({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      // Preserve trackpad gestures and browser zoom; map a mouse wheel to horizontal scrolling.
      if (
        event.ctrlKey || event.shiftKey ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      ) return;
      const scale = event.deltaMode === 1 ? 16 :
        event.deltaMode === 2 ? element.clientWidth : 1;
      const delta = event.deltaY * scale;
      const next = Math.max(0, Math.min(
        element.scrollWidth - element.clientWidth,
        element.scrollLeft + delta,
      ));
      if (next !== element.scrollLeft) {
        event.preventDefault();
        element.scrollLeft = next;
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);
  return (
    <div ref={ref} className="resource-chart-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

const METRICS = [
  { key: "host_count", label: "Host", tone: "host", unit: "대" },
  { key: "vm_count", label: "VM", tone: "vm", unit: "대" },
  {
    key: "storage_count",
    label: "Storage",
    tone: "storage",
    unit: "개",
  },
] as const;
const number = (value: number) => value.toLocaleString("ko-KR");

export default function InfrastructureSummary({
  rows,
  data,
}: {
  rows: DataRow[];
  data: Bootstrap;
}) {
  const sum = (items: DataRow[], key: string) =>
    items.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const regions = [
    ...data.regions.map((region) => ({
      id: region.id,
      name: region.region_name,
    })),
    ...[...new Set(rows.map((row) => row.region))]
      .filter(
        (id): id is number => id != null && !data.regions.some((region) => region.id === id),
      )
      .map((id) => ({ id, name: "미등록 리전" })),
  ];
  return (
    <section className="resource-summary" aria-label="리전별 인프라 자원 요약">
      <div className="resource-summary-scroll">
        <div className="resource-summary-charts">
          {METRICS.map((metric) => {
            const distribution = regions.map((region) => {
              const items = rows.filter((row) => row.region === region.id);
              const known = items.filter((row) => row[metric.key] != null);
              return {
                ...region,
                count: items.length,
                missing: items.length - known.length,
                value: known.length ? sum(known, metric.key) : null,
              };
            });
            const missing = rows.filter(
              (row) => row[metric.key] == null,
            ).length;
            distribution.sort((a, b) => {
              if (a.value == null || b.value == null)
                return a.value == null
                  ? b.value == null
                    ? a.name.localeCompare(b.name)
                    : 1
                  : -1;
              return b.value - a.value || a.name.localeCompare(b.name);
            });
            const maximum = Math.max(
              1,
              ...distribution.map((region) => region.value ?? 0),
            );
            const total =
              rows.length > 0 && missing === rows.length
                ? "—"
                : number(sum(rows, metric.key));
            return (
              <article
                className={`resource-metric resource-metric-${metric.tone}`}
                key={metric.key}
                aria-label={`${metric.label} 리전별 현황`}
              >
                <header className="resource-metric-heading">
                  <h2>
                    <i />
                    {metric.label}
                  </h2>
                  <div className="resource-summary-total">
                    <strong>{total}</strong>
                    <span>{metric.unit}</span>
                  </div>
                </header>
                <p className="resource-metric-note">
                  {missing
                    ? `수량 미입력 ${missing}건은 합계 제외`
                    : `${regions.length}개 리전 · ${rows.length}개 자원 항목`}
                </p>
                {distribution.length ? (
                  <ChartScroll label={`${metric.label} 리전별 그래프 가로 스크롤`}>
                    <div
                      className="resource-location-chart"
                      role="list"
                      aria-label={`${metric.label} 리전별 수량`}
                      style={{
                        gridTemplateColumns: `repeat(${distribution.length}, minmax(max-content, 1fr))`,
                      }}
                    >
                      {distribution.map((region) => {
                        const label = !region.count
                          ? "미등록"
                          : region.value == null
                            ? "미입력"
                            : `${number(region.value)}${region.missing ? " + 미입력" : ""}`;
                        return (
                          <div
                            className="resource-location"
                            role="listitem"
                            key={region.id}
                            aria-label={`${region.name}: ${label}`}
                          >
                            <div className="resource-bar-track">
                              <div
                                className={`resource-bar${region.value == null ? " resource-bar-unknown" : ""}`}
                                style={{
                                  height:
                                    region.value == null || region.value === 0
                                      ? "0px"
                                      : `${(region.value / maximum) * 56}px`,
                                }}
                                title={`${region.name}: ${label}`}
                              >
                                <strong className="resource-bar-value">
                                  {region.value != null && region.missing
                                    ? `${number(region.value)}*`
                                    : label}
                                </strong>
                              </div>
                            </div>
                            <span
                              className="resource-location-name"
                              title={region.name}
                            >
                              {region.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </ChartScroll>
                ) : (
                  <p className="resource-chart-empty">
                    등록된 리전이 없습니다.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
