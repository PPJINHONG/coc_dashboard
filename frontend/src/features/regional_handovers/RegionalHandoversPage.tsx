import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../shared/api/client";
import type { FeaturePageProps } from "../../shared/feature";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Icon from "../../shared/components/Icon";
import Modal from "../../shared/components/Modal";
import {
  createHandover,
  deleteHandover,
  listHandovers,
  updateHandover,
  type HandoverCategory,
  type HandoverPriority,
  type HandoverRegion,
  type HandoverStatus,
  type RegionalHandover,
  type RegionalHandoverInput,
} from "./api";
import HandoverForm from "./HandoverForm";


type RegionFilter = "all" | HandoverRegion;
type PriorityFilter = "all" | HandoverPriority;
type StatusFilter = "all" | HandoverStatus;
type CategoryFilter = "all" | HandoverCategory;
type FormMode = "create" | "edit" | null;

const REGIONS: HandoverRegion[] = ["KR", "EU", "NA"];
const PRIORITIES: HandoverPriority[] = ["high", "normal"];
const PRIORITY_LABELS: Record<HandoverPriority, string> = {
  high: "중요",
  normal: "일반",
};
const PRIORITY_ORDER: Record<HandoverPriority, number> = { high: 0, normal: 1 };
const STATUS_LABELS: Record<HandoverStatus, string> = {
  in_progress: "진행 중",
  completed: "완료",
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function textContent(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return parsed.body.textContent?.replace(/\s+/g, " ").trim() || "";
}

function regionCounts(rows: RegionalHandover[], region: RegionFilter) {
  const scoped = region === "all" ? rows : rows.filter((row) => row.region === region);
  return {
    total: scoped.length,
    active: scoped.filter((row) => row.status !== "completed").length,
    issues: scoped.filter((row) => row.category === "issue").length,
    notices: scoped.filter((row) => row.category === "notice").length,
    high: scoped.filter((row) => row.priority === "high").length,
    normal: scoped.filter((row) => row.priority === "normal").length,
  };
}

export default function RegionalHandoversPage({ user, refresh, setDirty, setBusy }: FeaturePageProps) {
  const [handovers, setHandovers] = useState<RegionalHandover[]>([]);
  const [revision, setRevision] = useState(0);
  const [region, setRegion] = useState<RegionFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<RegionalHandover | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canWrite = Boolean(user);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listHandovers();
      setRevision(response.revision);
      setHandovers(response.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "핸드오버 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => {
    setDirty(false);
    setBusy(false);
  }, [setBusy, setDirty]);

  const visibleHandovers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return handovers
      .filter((row) => region === "all" || row.region === region)
      .filter((row) => priority === "all" || row.priority === priority)
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .filter((row) => category === "all" || row.category === category)
      .filter((row) => !normalizedQuery || `${row.title} ${row.author_name} ${textContent(row.content_html)}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))
      .sort((left, right) => {
        const statusDifference = Number(left.status === "completed") - Number(right.status === "completed");
        if (statusDifference) return statusDifference;
        const priorityDifference = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
        if (priorityDifference) return priorityDifference;
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      });
  }, [category, handovers, priority, query, region, statusFilter]);

  function markDirty(value: boolean) {
    setFormDirty(value);
    setDirty(value);
  }

  function closeForm() {
    if (formDirty && !window.confirm("입력 중인 내용을 취소하시겠습니까?")) return;
    setMode(null);
    setEditing(null);
    markDirty(false);
  }

  async function save(values: RegionalHandoverInput) {
    setBusy(true);
    try {
      const response = mode === "edit" && editing
        ? await updateHandover(editing.id, revision, values)
        : await createHandover(revision, values);
      setRevision(response.revision);
      setMode(null);
      setEditing(null);
      markDirty(false);
      await load();
      try {
        await refresh();
      } catch {
        setError("홈 화면 건수를 새로고침하지 못했습니다. 목록의 저장 내용은 반영되었습니다.");
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) await load();
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: RegionalHandover) {
    setDeleting(row.id);
    setError("");
    setBusy(true);
    try {
      const response = await deleteHandover(row.id, revision);
      setRevision(response.revision);
      setConfirmDelete(null);
      await load();
      try {
        await refresh();
      } catch {
        setError("홈 화면 건수를 새로고침하지 못했습니다. 핸드오버는 삭제되었습니다.");
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) await load();
      setError(cause instanceof Error ? cause.message : "핸드오버를 삭제하지 못했습니다.");
    } finally {
      setDeleting(null);
      setBusy(false);
    }
  }

  function openEdit(row: RegionalHandover) {
    setEditing(row);
    setMode("edit");
    setConfirmDelete(null);
  }

  const allCounts = regionCounts(handovers, "all");

  return (
    <div className="handover-page">
      <section className="handover-overview" aria-label="권역별 핸드오버 현황">
        <article className="handover-intro-card">
          <span className="handover-intro-badge"><Icon name="layers" size={13} /> 권역 운영 인수인계</span>
          <h1>권역별 핸드오버</h1>
          <p>다음 권역이 바로 확인해야 할 이슈와 작업 내용을 공유합니다.</p>
          <footer>
            <div>
              <span className="handover-total-count">전체 {allCounts.total}건</span>
              <span>미완료 {allCounts.active}건</span>
            </div>
            {canWrite && (
              <button className="btn btn-primary handover-create" onClick={() => { setMode("create"); setEditing(null); }}>
                <span aria-hidden="true">＋</span> 핸드오버 등록
              </button>
            )}
          </footer>
        </article>

        {REGIONS.map((item) => {
          const counts = regionCounts(handovers, item);
          return (
            <button
              type="button"
              key={item}
              className={`handover-region-card${region === item ? " is-active" : ""}`}
              aria-pressed={region === item}
              onClick={() => setRegion((current) => current === item ? "all" : item)}
            >
              <span className="handover-region-card-head"><span>{item} 핸드오버</span><Icon name="globe" size={17} /></span>
              <strong>{counts.total}<small>건</small></strong>
              <span className="handover-region-active">미완료 <b>{counts.active}</b>건</span>
              <span className="handover-region-breakdown">
                <span>이슈 <b>{counts.issues}</b></span>
                <span>공지 <b>{counts.notices}</b></span>
              </span>
              <span className="handover-region-priorities">
                <span className="high"><i aria-hidden="true" />중요 <b>{counts.high}</b></span>
                <span className="normal"><i aria-hidden="true" />일반 <b>{counts.normal}</b></span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="handover-toolbar" aria-label="핸드오버 필터">
        <div className="handover-priority-filters" role="group" aria-label="중요도 선택">
          <button className={priority === "all" ? "is-active" : ""} onClick={() => setPriority("all")}>전체</button>
          {PRIORITIES.map((item) => (
            <button
              key={item}
              className={`${item}${priority === item ? " is-active" : ""}`}
              onClick={() => setPriority(item)}
            >
              <i aria-hidden="true" />{PRIORITY_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="handover-toolbar-fields">
          <select aria-label="상태 필터" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">전체 상태</option>
            <option value="in_progress">진행 중</option>
            <option value="completed">완료</option>
          </select>
          <select aria-label="구분 필터" value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}>
            <option value="all">전체 구분</option>
            <option value="issue">이슈</option>
            <option value="notice">공지</option>
          </select>
          <label className="handover-search">
            <Icon name="search" size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 본문, 작성자 검색" />
          </label>
          <button className="icon-button handover-refresh" aria-label="목록 새로고침" title="목록 새로고침" onClick={() => void load()}>
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </section>

      <div className="handover-list-heading">
        <h2>핸드오버 내용</h2>
        <span>{visibleHandovers.length}건 · 미완료와 중요도 우선</span>
      </div>

      {error && <ErrorMessage message={error} />}
      {loading ? (
        <div className="panel handover-empty" role="status">핸드오버를 불러오고 있습니다…</div>
      ) : visibleHandovers.length === 0 ? (
        <div className="panel handover-empty">
          <Icon name="layers" size={30} />
          <strong>조건에 맞는 핸드오버가 없습니다.</strong>
        </div>
      ) : (
        <section className="handover-feed" aria-label="핸드오버 내용 목록">
          {visibleHandovers.map((row) => (
            <article key={row.id} className={`handover-card priority-${row.priority} status-${row.status}`}>
              <header className="handover-card-header">
                <div className="handover-badges">
                  <span className={`handover-priority ${row.priority}`}><i aria-hidden="true" />{row.priority_label}</span>
                  <span className="handover-region">{row.region}</span>
                  <span className="handover-category">{row.category_label}</span>
                  <span className={`handover-status ${row.status}`}>{row.status_label}</span>
                </div>
                <time dateTime={row.updated_at}>최근 수정 {dateTime(row.updated_at)} KST</time>
              </header>
              <h3>{row.title}</h3>
              <div className="handover-rich-content" dangerouslySetInnerHTML={{ __html: row.content_html }} />
              <footer className="handover-card-footer">
                <div>
                  <strong>{row.author_name}</strong>
                  <span>등록 {dateTime(row.created_at)} KST</span>
                </div>
                <div className="handover-card-actions">
                  {row.can_edit && <button className="btn" onClick={() => openEdit(row)}>수정</button>}
                  {row.can_delete && <button className="btn btn-danger" onClick={() => setConfirmDelete(row.id)}>삭제</button>}
                </div>
              </footer>
              {confirmDelete === row.id && (
                <div className="handover-delete-confirm" role="alert">
                  <div><strong>이 핸드오버를 삭제할까요?</strong><span>본문 이미지도 함께 삭제됩니다.</span></div>
                  <div>
                    <button className="btn" disabled={deleting === row.id} onClick={() => setConfirmDelete(null)}>취소</button>
                    <button className="btn btn-danger" disabled={deleting === row.id} onClick={() => void remove(row)}>
                      {deleting === row.id ? "삭제 중…" : "삭제"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {mode && (
        <Modal
          title={mode === "create" ? "핸드오버 등록" : `핸드오버 #${editing?.id} 수정`}
          className="handover-modal"
          onClose={closeForm}
        >
          <HandoverForm
            key={editing?.id ?? "create"}
            handover={editing ?? undefined}
            onSubmit={save}
            onCancel={closeForm}
            onDirty={markDirty}
          />
        </Modal>
      )}
    </div>
  );
}
