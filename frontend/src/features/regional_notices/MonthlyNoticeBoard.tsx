import Icon from "../../shared/components/Icon";
import type { RegionalNotice } from "./api";
import NoticeDetail from "./NoticeDetail";
import { noticeSchedule } from "./NoticeTimeline";


function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year}년 ${Number(value)}월`;
}

export default function MonthlyNoticeBoard({
  rows,
  month,
  selected,
  busy,
  confirmDelete,
  onSelect,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  rows: RegionalNotice[];
  month: string;
  selected: RegionalNotice | null;
  busy: boolean;
  confirmDelete: boolean;
  onSelect: (notice: RegionalNotice) => void;
  onEdit: (notice: RegionalNotice) => void;
  onRequestDelete: (notice: RegionalNotice) => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const sorted = [...rows].sort(
    (left, right) => new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime(),
  );
  const active = sorted.find((notice) => notice.id === selected?.id) ?? sorted[0] ?? null;

  return (
    <section className="regional-notice-month-board">
      <div className="regional-notice-month-list-pane">
        <header className="regional-notice-month-list-head">
          <div>
            <strong>월 작업공지 목록</strong>
            <span>{monthLabel(month)} · 총 {sorted.length}건</span>
          </div>
          <p>일정 빠른순 · KST</p>
        </header>
        <div className="regional-notice-month-list regional-notice-scroll" role="region" aria-label="월 작업공지 목록" tabIndex={0}>
          {sorted.length ? sorted.map((notice) => {
            const isActive = notice.id === active?.id;
            return (
              <button
                type="button"
                className={`regional-notice-month-item is-${notice.country_code.toLowerCase()}${isActive ? " is-selected" : ""}`}
                aria-pressed={isActive}
                onClick={() => { onSelect(notice); onCancelDelete(); }}
                key={notice.id}
              >
                <div className="regional-notice-month-item-top">
                  <div>
                    <span className="regional-notice-month-region">{notice.region_name}</span>
                    <span className="regional-notice-month-category">{notice.category}</span>
                  </div>
                  <time dateTime={notice.scheduled_at}>{noticeSchedule(notice)}</time>
                </div>
                <h3>{notice.title}</h3>
                <p>{notice.content}</p>
                <footer>
                  <span><Icon name="person" size={12} /> {notice.author}</span>
                  <strong>상세 내용 <Icon name="chevron" size={12} /></strong>
                </footer>
              </button>
            );
          }) : (
            <div className="regional-notice-month-empty">
              <Icon name="flag" size={24} />
              <strong>이 달에 등록된 작업공지가 없습니다.</strong>
            </div>
          )}
        </div>
      </div>

      <aside className="regional-notice-preview-pane">
        <header>
          <div>
            {active && <span className={`is-${active.country_code.toLowerCase()}`}>{active.country_code}</span>}
            <small>{active ? active.region_name : "NO NOTICE"}</small>
          </div>
          <h2>작업 공지 상세 프리뷰</h2>
        </header>
        {active ? (
          <div key={active.id} className="regional-notice-scroll" role="region" aria-label="작업 공지 상세 내용" tabIndex={0}>
            <NoticeDetail
              notice={active}
              busy={busy}
              confirmDelete={confirmDelete && active.id === selected?.id}
              onEdit={onEdit}
              onRequestDelete={() => onRequestDelete(active)}
              onCancelDelete={onCancelDelete}
              onDelete={onDelete}
            />
          </div>
        ) : (
          <div className="regional-notice-preview-empty">왼쪽 목록에서 작업공지를 선택하세요.</div>
        )}
      </aside>
    </section>
  );
}
