import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Icon from "../../shared/components/Icon";
import Modal from "../../shared/components/Modal";
import {
  createRequest,
  deleteRequest,
  listRequests,
  updateRequest,
  type AssigneeRegion,
  type RegionalRequest,
  type RegionalRequestInput,
  type RequestStatus,
} from "./api";
import RequestForm from "./RequestForm";


type FormMode = "create" | "content" | "assignment" | null;
type RegionFilter = "all" | AssigneeRegion;
type StatusFilter = "all" | RequestStatus;

const REGIONS: AssigneeRegion[] = ["KR", "NA", "EU"];
const STATUSES: RequestStatus[] = ["open", "in_progress", "completed"];
const STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
};
const KST = "Asia/Seoul";

function dateTime(value: string, timeZone = KST) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function dayKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function isToday(ticket: RegionalRequest) {
  return dayKey(ticket.schedule_start) === dayKey(new Date());
}

function scheduleText(ticket: RegionalRequest) {
  const start = ticket.schedule_start_display.replace("T", " ");
  const end = ticket.schedule_end_display.replace("T", " ");
  return `${start} – ${end} ${ticket.schedule_timezone}`;
}

function statusCounts(rows: RegionalRequest[]) {
  return {
    open: rows.filter((ticket) => ticket.status === "open").length,
    in_progress: rows.filter((ticket) => ticket.status === "in_progress").length,
    completed: rows.filter((ticket) => ticket.status === "completed").length,
  };
}

function plainContent(html: string) {
  const documentValue = new DOMParser().parseFromString(html, "text/html");
  return documentValue.body.textContent?.replace(/\s+/g, " ").trim() || "내용 없음";
}

export default function RegionalRequestsPage({ snapshot, user, setDirty }: FeaturePageProps) {
  const [tickets, setTickets] = useState<RegionalRequest[]>([]);
  const [region, setRegion] = useState<RegionFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [todayOnly, setTodayOnly] = useState(false);
  const [selected, setSelected] = useState<RegionalRequest | null>(null);
  const [mode, setMode] = useState<FormMode>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canWrite = Boolean(user && user.role !== "observer");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listRequests(snapshot.month);
      setTickets(rows);
      setSelected((current) => current ? rows.find((row) => row.id === current.id) ?? current : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청작업 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [snapshot.month]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const regionRows = useMemo(
    () => region === "all" ? tickets : tickets.filter((ticket) => ticket.region === region),
    [region, tickets],
  );
  const todayCount = useMemo(() => regionRows.filter(isToday).length, [regionRows]);
  const filteredByDay = useMemo(
    () => todayOnly ? regionRows.filter(isToday) : regionRows,
    [regionRows, todayOnly],
  );
  const visibleTickets = useMemo(
    () => status === "all" ? filteredByDay : filteredByDay.filter((ticket) => ticket.status === status),
    [filteredByDay, status],
  );
  const selectedRegionCounts = useMemo(() => statusCounts(filteredByDay), [filteredByDay]);

  function dirty(value: boolean) {
    setFormDirty(value);
    setDirty(value);
  }

  function closeModal() {
    if (formDirty && !window.confirm("입력 중인 내용을 취소하시겠습니까?")) return;
    setSelected(null);
    setMode(null);
    setConfirmDelete(false);
    dirty(false);
  }

  async function save(values: RegionalRequestInput) {
    if (mode === "create") {
      const response = await createRequest(values);
      setSelected(response.row);
    } else if (selected) {
      const { status: nextStatus, ...contentValues } = values;
      const payload: Partial<RegionalRequestInput> = mode === "assignment"
        ? { assignee_regions: values.assignee_regions, assignee_name: values.assignee_name }
        : contentValues;
      if (nextStatus !== selected.status) payload.status = nextStatus;
      const response = await updateRequest(selected.id, payload);
      setSelected(response.row);
    }
    setMode(null);
    dirty(false);
    await load();
  }

  async function remove() {
    if (!selected) return;
    setDeleting(true);
    setError("");
    try {
      await deleteRequest(selected.id);
      setSelected(null);
      setConfirmDelete(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청작업을 삭제하지 못했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  function openEdit() {
    if (!selected) return;
    setMode(selected.can_edit_content ? "content" : "assignment");
  }

  const regionCard = (value: RegionFilter, label: string) => {
    const rows = value === "all" ? tickets : tickets.filter((ticket) => ticket.region === value);
    const counts = statusCounts(rows);
    return (
      <button
        key={value}
        className={region === value ? "is-active" : ""}
        aria-pressed={region === value}
        onClick={() => setRegion(value)}
      >
        <span>{label}</span>
        <strong>{rows.length}</strong>
        <small>
          <i><span>Open</span><b>{counts.open}</b></i>
          <i><span>In Progress</span><b>{counts.in_progress}</b></i>
          <i><span>Completed</span><b>{counts.completed}</b></i>
        </small>
      </button>
    );
  };

  return (
    <div className="regional-request-page">
      <span className="eyebrow">REGIONAL REQUESTS</span>
      <header className="regional-request-heading">
        <div><h1>권역별 요청작업</h1></div>
        {canWrite && (
          <button className="btn btn-primary regional-request-create" onClick={() => { setMode("create"); setSelected(null); }}>
            <span aria-hidden="true">＋</span> 요청작업 생성
          </button>
        )}
      </header>

      <section className="regional-request-controls" aria-label="요청작업 필터">
        <div className="regional-request-region-tabs" role="group" aria-label="리전 선택">
          {regionCard("all", "전체 리전")}
          {REGIONS.map((item) => regionCard(item, item))}
        </div>
        <div className="regional-request-filter-row">
          <div className="regional-request-status-filter" role="group" aria-label="상태 선택">
            <button className={status === "all" ? "is-active" : ""} onClick={() => setStatus("all")}>전체 <span>{filteredByDay.length}</span></button>
            {STATUSES.map((item) => (
              <button key={item} className={`${item}${status === item ? " is-active" : ""}`} onClick={() => setStatus(item)}>
                {STATUS_LABELS[item]} <span>{selectedRegionCounts[item]}</span>
              </button>
            ))}
          </div>
          <button
            className={`regional-request-today-filter${todayOnly ? " is-active" : ""}`}
            aria-pressed={todayOnly}
            onClick={() => setTodayOnly((current) => !current)}
          >
            TODAY <span>{todayCount}</span>
          </button>
        </div>
      </section>

      <section className="panel regional-request-list-panel">
        <header className="regional-request-list-head">
          <h2>요청작업 목록</h2>
          <span>{visibleTickets.length}건</span>
        </header>

        {error && <ErrorMessage message={error} />}
        {loading ? (
          <div className="regional-request-empty" role="status">요청작업을 불러오고 있습니다…</div>
        ) : visibleTickets.length === 0 ? (
          <div className="regional-request-empty">
            <Icon name="work" size={28} />
            <strong>등록된 요청작업이 없습니다.</strong>
          </div>
        ) : (
          <div className="regional-request-ticket-list">
            {visibleTickets.map((ticket) => {
              const today = isToday(ticket);
              return (
                <button
                  type="button"
                  className={`regional-request-ticket regional-request-ticket-${ticket.status}${today ? " is-today" : ""}`}
                  key={ticket.id}
                  onClick={() => { setSelected(ticket); setMode(null); }}
                >
                  <span className="regional-request-ticket-grid">
                    <span className="regional-request-ticket-region-status">
                      <span><small>권역</small><i className="regional-request-region">{ticket.region}</i></span>
                      <span><small>상태</small><i className={`regional-request-status ${ticket.status}`}>{STATUS_LABELS[ticket.status]}</i></span>
                    </span>
                    <span className="regional-request-ticket-title">
                      <small>요청작업</small>
                      <strong>{ticket.title}</strong>
                    </span>
                    <span className="regional-request-ticket-schedule">
                      <small>작업 일정</small>
                      <span>{scheduleText(ticket)}</span>
                      {today && <b>TODAY</b>}
                    </span>
                    <span className="regional-request-ticket-content"><small>작업 내용</small><span>{plainContent(ticket.content_html)}</span></span>
                    <span className="regional-request-ticket-requester"><small>Requester</small><span>{ticket.requester}</span></span>
                    <span className={`regional-request-ticket-assignee${ticket.assignee_name ? "" : " is-unassigned"}`}><small>담당자</small><span>{ticket.assignee_name || "미지정"}</span></span>
                    <span className="regional-request-ticket-assignee-region"><small>담당 권역</small><span>{ticket.assignee_regions.join(" · ") || "미지정"}</span></span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {mode === "create" && (
        <Modal title="요청작업 생성" className="regional-request-modal regional-request-form-modal" onClose={closeModal}>
          <RequestForm mode="create" onSubmit={save} onCancel={closeModal} onDirty={dirty} />
        </Modal>
      )}

      {selected && (
        <Modal
          title={`요청작업 #${selected.id}`}
          className={`regional-request-modal ${mode === "assignment" ? "regional-request-assignment-modal" : mode === "content" ? "regional-request-form-modal" : "regional-request-detail-modal"}`}
          onClose={closeModal}
        >
          {mode === "content" || mode === "assignment" ? (
            <RequestForm mode={mode} ticket={selected} onSubmit={save} onCancel={() => { setMode(null); dirty(false); }} onDirty={dirty} />
          ) : (
            <article className="regional-request-detail">
              <header className="regional-request-detail-heading">
                <div className="regional-request-detail-kicker"><span>{selected.region}</span><span className={`regional-request-status ${selected.status}`}>{selected.status_label}</span>{isToday(selected) && <b>TODAY</b>}</div>
                <h2>{selected.title}</h2>
                <p>요청 #{selected.id} · {selected.author_name} · {dateTime(selected.requested_at)}</p>
              </header>

              <div className="regional-request-detail-grid">
                <section><span>Requester</span><strong>{selected.requester}</strong></section>
                <section><span>작업 일정</span><strong>{scheduleText(selected)}</strong></section>
                <section><span>담당 권역</span><strong>{selected.assignee_regions.length ? selected.assignee_regions.join(" · ") : "미지정"}</strong></section>
                <section><span>담당자</span><strong>{selected.assignee_name || "미지정"}</strong></section>
              </div>

              <section className="regional-request-content">
                <h3>작업 내용</h3>
                <div className="regional-request-rich-content" dangerouslySetInnerHTML={{ __html: selected.content_html }} />
              </section>

              {confirmDelete && (
                <div className="regional-request-delete-confirm" role="alert">
                  <div><strong>이 요청작업을 삭제할까요?</strong><span>본문 이미지와 담당 정보도 함께 삭제됩니다.</span></div>
                  <div><button className="btn" onClick={() => setConfirmDelete(false)}>취소</button><button className="btn btn-danger" disabled={deleting} onClick={() => void remove()}>{deleting ? "삭제 중…" : "삭제"}</button></div>
                </div>
              )}

              <footer className="regional-request-detail-actions">
                <button className="btn regional-request-detail-button" onClick={closeModal}>닫기</button>
                {(selected.can_edit_content || selected.can_update_assignment) && <button className="btn btn-primary regional-request-detail-button" onClick={openEdit}>수정</button>}
                {selected.can_delete && <button className="btn btn-danger regional-request-detail-button" onClick={() => setConfirmDelete(true)}>삭제</button>}
              </footer>
            </article>
          )}
        </Modal>
      )}
    </div>
  );
}
