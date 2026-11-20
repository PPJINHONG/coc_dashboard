import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../shared/api/client";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Modal from "../../shared/components/Modal";
import type { FeaturePageProps } from "../../shared/feature";
import {
  createNotice,
  deleteNotice,
  listNotices,
  updateNotice,
  type NoticeCountry,
  type RegionalNotice,
  type RegionalNoticeInput,
} from "./api";
import NoticeDetail from "./NoticeDetail";
import NoticeForm from "./NoticeForm";
import MonthlyNoticeBoard from "./MonthlyNoticeBoard";
import {
  COUNTRY_LABELS,
  isToday,
  MonthlyTimeline,
  NOTICE_COUNTRIES,
  TodayNotices,
} from "./NoticeTimeline";


export type ViewMode = "timeline" | "today";
type RegionFilter = "all" | NoticeCountry;
type FormMode = "create" | "edit" | null;

export default function RegionalNoticesPage({
  data,
  snapshot,
  refresh,
  setDirty,
  setBusy: setPageBusy,
  view,
}: FeaturePageProps & { view: ViewMode }) {
  const [notices, setNotices] = useState<RegionalNotice[]>([]);
  const [region, setRegion] = useState<RegionFilter>("all");
  const [selected, setSelected] = useState<RegionalNotice | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [revision, setRevision] = useState(snapshot.revision);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const canManage = data.can_manage;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await listNotices(snapshot.month);
      setNotices(rows);
      setSelected((current) => current ? rows.find((row) => row.id === current.id) ?? null : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "작업공지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [snapshot.month]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setRevision(snapshot.revision); }, [snapshot.revision]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const filtered = useMemo(
    () => region === "all" ? notices : notices.filter((notice) => notice.country_code === region),
    [notices, region],
  );
  const todayRows = useMemo(
    () => notices.filter(isToday),
    [notices],
  );

  const onFormDirty = useCallback((value: boolean) => {
    setFormDirty(value);
    setDirty(value);
  }, [setDirty]);

  function closeForm() {
    if (formDirty && !window.confirm("입력 중인 내용을 취소하시겠습니까?")) return;
    setFormMode(null);
    onFormDirty(false);
  }

  async function save(values: RegionalNoticeInput) {
    setBusy(true);
    setPageBusy(true);
    setError("");
    try {
      const response = formMode === "edit" && selected
        ? await updateNotice(selected.id, revision, values)
        : await createNotice(revision, values);
      setRevision(response.revision);
      setSelected(response.row.month === snapshot.month ? response.row : null);
      setFormMode(null);
      onFormDirty(false);
      await Promise.all([load(), refresh()]);
    } catch (cause) {
      const fieldError = cause instanceof ApiError && Object.values(cause.fieldErrors).flat()[0];
      setError(fieldError || (cause instanceof Error ? cause.message : "작업공지를 저장하지 못했습니다."));
    } finally {
      setBusy(false);
      setPageBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setPageBusy(true);
    setError("");
    try {
      const response = await deleteNotice(selected.id, revision);
      setRevision(response.revision);
      setSelected(null);
      setConfirmDelete(false);
      await Promise.all([load(), refresh()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "작업공지를 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
      setPageBusy(false);
    }
  }

  function selectFromTimeline(notice: RegionalNotice) {
    setSelected(notice);
    setConfirmDelete(false);
    window.requestAnimationFrame(() => {
      boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="regional-notice-page">
      <span className="eyebrow">REGIONAL NOTICES</span>
      <header className="regional-notice-heading">
        <div>
          <h1>권역별 작업공지</h1>
          <p>한 달의 작업 일정을 리전 타임라인으로 확인하고 오늘 작업을 빠르게 구분합니다.</p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary regional-notice-create"
            onClick={() => { setSelected(null); setFormMode("create"); setError(""); }}
          >
            <span aria-hidden="true">＋</span> 작업공지 생성
          </button>
        )}
      </header>

      {view === "timeline" && (
        <section className="regional-notice-controls" aria-label="작업공지 리전 필터">
        <div className="regional-notice-region-filter" role="group" aria-label="리전 선택">
          <button
            type="button"
            className={region === "all" ? "is-active" : ""}
            onClick={() => setRegion("all")}
          >
            <span>전체 리전</span><b>{notices.length}</b>
          </button>
          {NOTICE_COUNTRIES.map((country) => {
            const count = notices.filter((notice) => notice.country_code === country).length;
            return (
              <button
                type="button"
                className={`is-${country.toLowerCase()}${region === country ? " is-active" : ""}`}
                onClick={() => setRegion(country)}
                key={country}
              >
                <i />
                <span>{country}<small>{COUNTRY_LABELS[country]}</small></span>
                <b>{count}</b>
              </button>
            );
          })}
        </div>
        </section>
      )}

      {error && !formMode && <ErrorMessage message={error} />}
      {loading ? (
        <div className="regional-notice-loading" role="status">작업공지를 불러오고 있습니다…</div>
      ) : view === "timeline" ? (
        <>
          <MonthlyTimeline rows={filtered} month={snapshot.month} onSelect={selectFromTimeline} />
          <div ref={boardRef} className="regional-notice-month-board-anchor">
            <MonthlyNoticeBoard
              rows={filtered}
              month={snapshot.month}
              selected={selected}
              busy={busy}
              confirmDelete={confirmDelete}
              onSelect={setSelected}
              onEdit={(notice) => { setSelected(notice); setFormMode("edit"); setError(""); }}
              onRequestDelete={(notice) => { setSelected(notice); setConfirmDelete(true); }}
              onCancelDelete={() => setConfirmDelete(false)}
              onDelete={() => void remove()}
            />
          </div>
        </>
      ) : (
        <TodayNotices rows={todayRows} onSelect={setSelected} />
      )}

      {selected && view === "today" && !formMode && (
        <Modal
          title="작업공지 상세"
          className="regional-notice-detail-modal"
          onClose={() => { setSelected(null); setConfirmDelete(false); }}
        >
          <NoticeDetail
            notice={selected}
            busy={busy}
            confirmDelete={confirmDelete}
            onEdit={(notice) => { setSelected(notice); setFormMode("edit"); setError(""); }}
            onRequestDelete={() => setConfirmDelete(true)}
            onCancelDelete={() => setConfirmDelete(false)}
            onDelete={() => void remove()}
          />
        </Modal>
      )}

      {formMode && (
        <Modal
          title={formMode === "create" ? "작업공지 생성" : "작업공지 수정"}
          className="regional-notice-form-modal"
          onClose={closeForm}
        >
          <NoticeForm
            notice={formMode === "edit" ? selected : null}
            month={snapshot.month}
            busy={busy}
            error={error}
            onSubmit={save}
            onCancel={closeForm}
            onDirty={onFormDirty}
          />
        </Modal>
      )}
    </div>
  );
}
