import Icon from "../../shared/components/Icon";
import type { RegionalNotice } from "./api";
import { COUNTRY_LABELS, noticeSchedule } from "./NoticeTimeline";


export default function NoticeDetail({
  notice,
  busy,
  confirmDelete,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  notice: RegionalNotice;
  busy: boolean;
  confirmDelete: boolean;
  onEdit: (notice: RegionalNotice) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="regional-notice-detail-body">
      <section className={`regional-notice-detail-hero is-${notice.country_code.toLowerCase()}`}>
        <div>
          <span className="regional-notice-country-badge">{notice.country_code}</span>
          <strong className="regional-notice-detail-region-name">{notice.region_name}</strong>
        </div>
        <span className="regional-notice-detail-category">{notice.category}</span>
        <h2>{notice.title}</h2>
        <p>{noticeSchedule(notice)}</p>
      </section>

      <section className="regional-notice-detail-facts">
        <div><span>리전</span><strong>{notice.region_name}</strong><small>{notice.country_code} · {COUNTRY_LABELS[notice.country_code]}</small></div>
        <div><span>작업 일정</span><strong>{noticeSchedule(notice)}</strong><small>Asia/Seoul</small></div>
        <div><span>작업 카테고리</span><strong>{notice.category}</strong><small>OPERATION TYPE</small></div>
        <div><span>작성자</span><strong>{notice.author}</strong><small>NOTICE OWNER</small></div>
      </section>

      <section className="regional-notice-detail-content">
        <header><h3>작업 내용</h3><span>NOTICE DETAIL</span></header>
        <div>{notice.content}</div>
      </section>

      {confirmDelete && (
        <div className="regional-notice-delete-confirm">
          <div><strong>이 작업공지를 삭제하시겠습니까?</strong><span>삭제 후에는 목록에서 바로 사라집니다.</span></div>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onCancelDelete}>취소</button>
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onDelete}>{busy ? "삭제 중…" : "삭제"}</button>
        </div>
      )}

      <footer className="regional-notice-detail-actions">
        <span><Icon name="person" size={15} /> {notice.author}</span>
        {notice.can_edit && !confirmDelete && (
          <div>
            <button type="button" className="btn btn-danger" onClick={onRequestDelete}>삭제</button>
            <button type="button" className="btn btn-primary" onClick={() => onEdit(notice)}>작업공지 수정</button>
          </div>
        )}
      </footer>
    </div>
  );
}
