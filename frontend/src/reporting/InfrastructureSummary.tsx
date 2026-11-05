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

type Count = number | null;
const field = (key: string) => (row: DataRow): Count =>
  row[key] == null ? null : Number(row[key]);
const computeRack = field("compute_rack_count");
const storageRack = field("storage_count");
// Rack은 Compute Rack + Storage Rack입니다. 둘 다 비어 있을 때만 미입력이며 한쪽만 비면 입력된 값만 더합니다.
const rack = (row: DataRow): Count => {
  const compute = computeRack(row);
  const storage = storageRack(row);
  return compute == null && storage == null ? null : (compute ?? 0) + (storage ?? 0);
};
const METRICS: {
  key: string;
  label: string;
  tone: string;
  unit: string;
  value: (row: DataRow) => Count;
  missing: (row: DataRow) => boolean;
}[] = [
  { key: "host", label: "Host", tone: "host", unit: "대", value: field("host_count"), missing: (row) => row.host_count == null },
  { key: "vm", label: "VM", tone: "vm", unit: "대", value: field("vm_count"), missing: (row) => row.vm_count == null },
  {
    key: "rack",
    label: "Rack",
    tone: "rack",
    unit: "개",
    value: rack,
    missing: (row) => computeRack(row) == null || storageRack(row) == null,
  },
];
const number = (value: number) => value.toLocaleString("ko-KR");

export default function InfrastructureSummary({
  rows,
  data,
  country = "",
}: {
  rows: DataRow[];
  data: Bootstrap;
  country?: string;
}) {
  const sum = (items: DataRow[], value: (row: DataRow) => Count) =>
    items.reduce((total, row) => total + (value(row) ?? 0), 0);
  const regions = [
    ...data.regions
      .filter((region) => !country || region.country_code === country)
      .map((region) => ({ id: region.id, name: region.region_name })),
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
              const known = items.filter((row) => metric.value(row) != null);
              return {
                ...region,
                count: items.length,
                missing: items.filter(metric.missing).length,
                value: known.length ? sum(known, metric.value) : null,
              };
            });
            const missing = rows.filter(metric.missing).length;
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
              rows.length > 0 && rows.every((row) => metric.value(row) == null)
                ? "—"
                : number(sum(rows, metric.value));
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
