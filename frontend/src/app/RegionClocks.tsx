import { useEffect, useRef, useState } from "react";
import Icon from "../shared/components/Icon";
import "./region-clocks.css";

/** 3권역 표준시. 한국 → 유럽(독일) → 북미(얼바인) 순으로 보여 줍니다. 서머타임은 브라우저 시간대 정보로 자동 반영합니다. */
const ZONES = [
  { id: "kr", region: "한국", city: "서울", timeZone: "Asia/Seoul", abbr: ["KST", "KST"] },
  { id: "eu", region: "유럽", city: "독일", timeZone: "Europe/Berlin", abbr: ["CET", "CEST"] },
  { id: "na", region: "북미", city: "얼바인", timeZone: "America/Los_Angeles", abbr: ["PST", "PDT"] },
] as const;

const partsFormat = new Map<string, Intl.DateTimeFormat>();
/** 그 시간대의 UTC 기준 차이(분). */
function offsetMinutes(timeZone: string, date: Date): number {
  let format = partsFormat.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormat.set(timeZone, format);
  }
  const part = Object.fromEntries(format.formatToParts(date).map((item) => [item.type, item.value]));
  const local = Date.UTC(+part.year, +part.month - 1, +part.day, +part.hour, +part.minute, +part.second);
  return Math.round((local - date.getTime()) / 60000);
}

/** 1월·7월 중 작은 차이를 표준시로 보고, 지금이 더 크면 서머타임입니다. */
function isDaylight(timeZone: string, date: Date): boolean {
  const year = date.getUTCFullYear();
  const standard = Math.min(
    offsetMinutes(timeZone, new Date(Date.UTC(year, 0, 1))),
    offsetMinutes(timeZone, new Date(Date.UTC(year, 6, 1))),
  );
  return offsetMinutes(timeZone, date) > standard;
}

const utcLabel = (minutes: number) => {
  const sign = minutes < 0 ? "-" : "+";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
};

function differenceLabel(minutes: number): string {
  if (minutes === 0) return "기준";
  const hours = Math.abs(minutes) / 60;
  const text = Number.isInteger(hours) ? `${hours}시간` : `${hours.toFixed(1)}시간`;
  return `한국보다 ${text} ${minutes < 0 ? "느림" : "빠름"}`;
}

/** 사이드바 하단의 시계 버튼. 누르면 3권역 현재 시각을 띄웁니다. 열려 있을 때만 1초마다 갱신합니다. */
export default function RegionClocks({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const outside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const koreaOffset = offsetMinutes(ZONES[0].timeZone, now);
  return (
    <div className="region-clock" ref={rootRef}>
      <button
        ref={buttonRef}
        className={`nav-item${open ? " active" : ""}`}
        aria-expanded={open}
        aria-controls="region-clock-panel"
        aria-label="권역 시계"
        title={collapsed ? "권역 시계" : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="clock" size={18} />
        <span>권역 시계</span>
      </button>
      {open && (
        <div id="region-clock-panel" className="region-clock-panel" role="dialog" aria-label="3권역 현재 시각">
          <div className="region-clock-head">
            <strong>3권역 현재 시각</strong>
            <button
              className="icon-button borderless"
              aria-label="닫기"
              title="닫기"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <ul>
            {ZONES.map((zone) => {
              const offset = offsetMinutes(zone.timeZone, now);
              const daylight = isDaylight(zone.timeZone, now);
              return (
                <li key={zone.id} data-zone={zone.id}>
                  <div className="region-clock-place">
                    <strong>{zone.region}</strong>
                    <small>
                      {zone.city} · {zone.abbr[daylight ? 1 : 0]} {utcLabel(offset)}
                    </small>
                  </div>
                  <div className="region-clock-time">
                    <time dateTime={now.toISOString()}>
                      {now.toLocaleTimeString("ko-KR", {
                        timeZone: zone.timeZone,
                        hourCycle: "h23",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </time>
                    <small>
                      {now.toLocaleDateString("ko-KR", {
                        timeZone: zone.timeZone,
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </small>
                    <small>{differenceLabel(offset - koreaOffset)}</small>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
