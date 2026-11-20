import type { CSSProperties } from "react";
import Icon from "../../shared/components/Icon";
import type { NoticeCountry, RegionalNotice } from "./api";


export const NOTICE_COUNTRIES: NoticeCountry[] = ["KR", "NA", "EU"];
export const COUNTRY_LABELS: Record<NoticeCountry, string> = {
  KR: "KOREA",
  NA: "NORTH AMERICA",
  EU: "EUROPE",
};

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  day: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});
const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
});

export function isToday(notice: RegionalNotice) {
  const today = Object.fromEntries(
    monthFormatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return notice.month === `${today.year}-${today.month}`
    && Number(dayFormatter.format(new Date(notice.scheduled_at))) === Number(dayFormatter.format(new Date()));
}

function dayOf(notice: RegionalNotice) {
  return Number(dayFormatter.format(new Date(notice.scheduled_at)));
}

function daysInMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).getUTCDate();
}

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year}년 ${Number(value)}월`;
}

function positionRows(rows: RegionalNotice[]) {
  const levelsUntil: number[] = [];
  const positioned = [...rows]
    .sort((left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime())
    .map((notice) => {
      const day = dayOf(notice);
      let level = levelsUntil.findIndex((until) => day - until >= 3);
      if (level < 0) level = levelsUntil.length;
      levelsUntil[level] = day;
      return { notice, day, level };
    });
  return { positioned, levels: Math.max(1, levelsUntil.length) };
}

function EmptyLane() {
  return <div className="regional-notice-lane-empty">등록된 일정 없음</div>;
}

export function MonthlyTimeline({
  rows,
  month,
  onSelect,
}: {
  rows: RegionalNotice[];
  month: string;
  onSelect: (notice: RegionalNotice) => void;
}) {
  const totalDays = daysInMonth(month);
  const tickDays = [...new Set([1, 8, 15, 22, totalDays])];
  const currentParts = Object.fromEntries(
    monthFormatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const currentMonth = `${currentParts.year}-${currentParts.month}`;
  const today = Number(dayFormatter.format(new Date()));
  const todayLeft = ((today - 1) / Math.max(1, totalDays - 1)) * 90;

  return (
    <section className="regional-notice-timeline-panel">
      <header>
        <div>
          <span>MONTHLY OPERATIONS</span>
          <h2>{monthLabel(month)} 작업 타임라인</h2>
        </div>
        <div className="regional-notice-legend" aria-label="리전 색상">
          {NOTICE_COUNTRIES.map((country) => (
            <span key={country}><i className={`is-${country.toLowerCase()}`} />{country}</span>
          ))}
        </div>
      </header>

      <div className="regional-notice-timeline">
        <div className="regional-notice-axis-label">REGION / CLUSTER</div>
        <div className="regional-notice-axis">
          {tickDays.map((day) => (
            <span
              key={day}
              style={{ left: `${((day - 1) / Math.max(1, totalDays - 1)) * 90}%` }}
            >
              {day}일
            </span>
          ))}
        </div>

        {NOTICE_COUNTRIES.map((country) => {
          const countryRows = rows.filter((notice) => notice.country_code === country);
          const { positioned, levels } = positionRows(countryRows);
          const laneStyle = { height: `${Math.max(72, 20 + levels * 39)}px` } as CSSProperties;
          return (
            <div className="regional-notice-timeline-row" key={country}>
              <div className={`regional-notice-lane-label is-${country.toLowerCase()}`}>
                <i />
                <div><strong>{country}</strong><span>{COUNTRY_LABELS[country]}</span></div>
                <small>{countryRows.length}</small>
              </div>
              <div className="regional-notice-lane" style={laneStyle}>
                {tickDays.map((day) => (
                  <i
                    className="regional-notice-gridline"
                    key={day}
                    style={{ left: `${((day - 1) / Math.max(1, totalDays - 1)) * 90}%` }}
                  />
                ))}
                {currentMonth === month && (
                  <i className="regional-notice-today-line" style={{ left: `${todayLeft}%` }}>
                    <span>TODAY</span>
                  </i>
                )}
                {!countryRows.length && <EmptyLane />}
                {positioned.map(({ notice, day, level }) => (
                  <button
                    type="button"
                    className={`regional-notice-timeline-card is-${country.toLowerCase()}`}
                    style={{
                      left: `${((day - 1) / Math.max(1, totalDays - 1)) * 90}%`,
                      top: `${10 + level * 39}px`,
                    }}
                    onClick={() => onSelect(notice)}
                    title={`${notice.region_name} · ${notice.title}`}
                    key={notice.id}
                  >
                    <span>{notice.category}</span>
                    <strong>{notice.title}</strong>
                    <small>{timeFormatter.format(new Date(notice.scheduled_at))}</small>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function TodayNotices({
  rows,
  onSelect,
}: {
  rows: RegionalNotice[];
  onSelect: (notice: RegionalNotice) => void;
}) {
  return (
    <section className="regional-notice-today-panel">
      <header>
        <div>
          <span>TODAY'S OPERATIONS</span>
          <h2>오늘 작업공지</h2>
        </div>
        <strong>{rows.length}건</strong>
      </header>
      <div className="regional-notice-today-columns">
        {NOTICE_COUNTRIES.map((country) => {
          const countryRows = rows.filter((notice) => notice.country_code === country);
          return (
            <section className={`regional-notice-today-country is-${country.toLowerCase()}`} key={country}>
              <header><div><i /><strong>{country}</strong><span>{COUNTRY_LABELS[country]}</span></div><b>{countryRows.length}</b></header>
              <div>
                {countryRows.length ? countryRows.map((notice) => (
                  <button type="button" onClick={() => onSelect(notice)} key={notice.id}>
                    <time>{timeFormatter.format(new Date(notice.scheduled_at))} KST</time>
                    <span>{notice.category}</span>
                    <strong>{notice.title}</strong>
                    <p>{notice.content}</p>
                    <footer><small>{notice.region_name} · {notice.author}</small><Icon name="chevron" size={13} /></footer>
                  </button>
                )) : <div className="regional-notice-today-empty">오늘 등록된 작업이 없습니다.</div>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function noticeSchedule(notice: RegionalNotice) {
  const date = new Date(notice.scheduled_at);
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)} KST`;
}
