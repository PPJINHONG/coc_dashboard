import { useCallback, useEffect, useRef, useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Modal from "../../shared/components/Modal";
import { errorMessage } from "../../shared/errors";
import { localDate } from "../../shared/fields";
import { sectionRows } from "../../shared/api/operations";
import * as api from "./api";
import type { HistoryLog, HistoryPage, RestorePreview } from "./api";
import LogList, { ACTIONS } from "./LogList";
import LogData from "./LogData";

export default function LogsPage({ data, snapshot, user, features, refresh, setBusy }: FeaturePageProps) {
  const labels = Object.fromEntries([
    ...features.map((item) => [item.id, item.label]),
    ["board", "게시판"], ["dashboard", "대시보드"], ["invites", "팀원 초대"], ["navigation", "개인 화면 설정"],
    ["regions", "리전 공통데이터"], ["staff-members", "인력 공통데이터"],
  ]);
  const people = Object.fromEntries(sectionRows(snapshot, "staff").map((row) => [String(row.id), String(row.staff_name ?? "")]));
  const [section, setSection] = useState("");
  const [action, setAction] = useState("");
  const [days, setDays] = useState("");
  const [detail, setDetail] = useState<HistoryLog | null>(null);
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [catalog, setCatalog] = useState<Pick<HistoryPage, "tabs" | "actions"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [target, setTarget] = useState<HistoryLog | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [step, setStep] = useState(1);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const generation = useRef(0);
  const fetchPage = useCallback((offset = "") => api.history({ section, action, days, offset }), [section, action, days]);
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setPage(null);
    setError(null);
    fetchPage().then((value) => {
      if (current === generation.current) { setPage(value); setCatalog(value); }
    }).catch((err) => {
      if (current === generation.current) setError(errorMessage(err));
    }).finally(() => {
      if (current === generation.current) setLoading(false);
    });
    return () => { generation.current++; };
  }, [fetchPage, reload, snapshot.revision]);

  async function loadMore() {
    if (loading || page?.next_offset == null) return;
    const current = generation.current;
    setLoading(true);
    try {
      const next = await fetchPage(String(page.next_offset));
      if (current === generation.current) {
        setPage({ ...next, results: [...page.results, ...next.results] });
        setError(null);
      }
    } catch (err) {
      if (current === generation.current) setError(errorMessage(err));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  async function openRestore(log: HistoryLog) {
    setTarget(log);
    setStep(1);
    setPreview(null);
    setRestoreError(null);
    setRestoring(true);
    setBusy(true);
    try {
      setPreview(await api.previewRestore(log.id));
    } catch (err) {
      setRestoreError(errorMessage(err));
    } finally {
      setRestoring(false);
      setBusy(false);
    }
  }
  async function confirmRestore() {
    if (!target || !preview || restoring) return;
    setRestoring(true);
    setBusy(true);
    setRestoreError(null);
    try {
      await api.restore(target.id, preview.token);
      setTarget(null);
      setNotice("선택한 변경을 복구했습니다. 복구 작업도 변경 이력에 기록했습니다.");
      setReload((value) => value + 1);
      try { await refresh(); } catch (err) { setError(`복구는 완료되었습니다. ${errorMessage(err)}`); }
    } catch (err) {
      setRestoreError(errorMessage(err));
      setPreview(null);
    } finally {
      setRestoring(false);
      setBusy(false);
    }
  }
  return <>
    <header className="page-heading">
      <div><span className="eyebrow">ACTIVITY</span><h1>변경 이력</h1><p>기능별 변경 내용과 변경자를 최신순으로 확인합니다.</p></div>
      <button className="btn btn-sm" disabled={loading || restoring} onClick={() => setReload((value) => value + 1)}>새로고침</button>
    </header>
    <section className="panel logs-filters" aria-label="변경 이력 분류">
      <div className="logs-chip-row"><span>탭</span><div className="logs-chips" role="group" aria-label="변경한 탭">
        <button aria-pressed={!section} disabled={restoring} onClick={() => setSection("")}>전체<b>{catalog?.tabs.reduce((sum, item) => sum + item.count, 0) ?? 0}</b></button>
        {catalog?.tabs.map((item) => <button key={item.id} aria-pressed={section === item.id} disabled={restoring} title={`최근 변경 ${localDate(item.latest_at)}`} onClick={() => setSection(item.id)}>{labels[item.id] ?? item.id}<b>{item.count}</b></button>)}
      </div></div>
      <div className="logs-chip-row"><span>작업</span><div className="logs-chips" role="group" aria-label="작업 종류">
        {[["", "전체"], ...Object.entries(ACTIONS)].map(([value, label]) => <button key={value} aria-pressed={action === value} disabled={restoring} className={value ? `logs-chip-${value}` : undefined} onClick={() => setAction(value)}>{value && <i aria-hidden="true" />}{label}{value && <b>{catalog?.actions?.[value] ?? 0}</b>}</button>)}
      </div></div>
      <div className="logs-chip-row"><span>기간</span><div className="logs-chips" role="group" aria-label="변경 기간">
        {[["", "전체"], ["1", "오늘"], ["7", "최근 7일"], ["30", "최근 30일"]].map(([value, label]) => <button key={value} aria-pressed={days === value} disabled={restoring} onClick={() => setDays(value)}>{label}</button>)}
      </div></div>
    </section>
    <section className="panel logs-content" aria-label="변경 목록" aria-busy={loading}>
      <div className="logs-list-heading"><h2>{section ? labels[section] ?? section : "전체 변경"}</h2><span>{page ? `${page.count}건 · 최신순` : "최신순"}</span></div>
      {notice && <p className="logs-notice" role="status">{notice}</p>}
      <ErrorMessage message={error} />
      {page && <LogList rows={page.results} labels={labels} data={data} people={people} onOpen={setDetail} />}
      {loading && <p className="report-empty" role="status">변경 이력을 불러오는 중입니다…</p>}
      {!loading && error && !page && <button className="btn" onClick={() => setReload((value) => value + 1)}>다시 시도</button>}
      {page?.next_offset != null && <div className="logs-more"><button className="btn" disabled={loading} onClick={loadMore}>이전 변경 더 보기</button></div>}
    </section>
    {detail && <Modal title="변경 상세" className="logs-detail-modal" onClose={() => setDetail(null)}>
      <dl className="logs-detail-meta">
        <div><dt>탭</dt><dd>{labels[detail.section] ?? detail.section}</dd></div>
        <div><dt>작업</dt><dd><span className={`logs-kind logs-kind-${detail.action}`}>{ACTIONS[detail.action] ?? detail.action}</span></dd></div>
        <div><dt>변경자</dt><dd>{detail.actor_name}</dd></div>
        <div><dt>변경 일시</dt><dd>{localDate(detail.created_at)}</dd></div>
        {detail.month && <div><dt>기준 월</dt><dd>{detail.month}</dd></div>}
        {(detail.countries?.length || detail.regions?.length) ? <div><dt>권역·리전</dt><dd>{[...(detail.countries ?? []), ...(detail.regions ?? []).map((item) => item.region_name)].join(" · ")}</dd></div> : null}
      </dl>
      <p className="logs-detail-summary">{detail.summary}</p>
      <LogData log={detail} data={data} people={people} />
      <div className="actions logs-detail-actions">
        {user?.is_staff && <span className="logs-restore-action">{!detail.can_restore && <small>{detail.restore_reason}</small>}<button className="btn" disabled={!detail.can_restore} onClick={() => { const log = detail; setDetail(null); void openRestore(log); }}>{detail.restored ? "복구 완료" : "이 변경 복구"}</button></span>}
        <button className="btn btn-primary" onClick={() => setDetail(null)}>닫기</button>
      </div>
    </Modal>}
    {target && <Modal title={step === 1 ? "변경 복구" : "정말 해당 변경사항을 복구하시겠습니까?"} onClose={() => { if (!restoring) setTarget(null); }}>
      <div className="logs-restore-body">
        <p className="logs-risk"><span className="logs-risk-badge">위험도 높음</span>복구 이후에는 롤백할 수 없습니다.</p>
        <p><strong>{labels[target.section] ?? target.section}</strong> · {localDate(target.created_at)}</p>
        <p>{target.summary}</p>
        <p>{step === 1 ? "이 변경에서 바뀐 데이터를 변경 전 상태로 되돌립니다." : "아래 버튼을 누르면 즉시 복구를 실행하며, 복구한 내용은 다시 되돌릴 수 없습니다."}</p>
        {preview && <p>{preview.month ? `${preview.month} 기준 · ` : ""}관련 데이터 {preview.affected_count}건을 복구하며, 등록한 항목은 삭제되고 삭제한 항목은 복원됩니다.</p>}
        <ErrorMessage message={restoreError} />
        {restoring && <p role="status">{preview ? "복구하는 중입니다…" : "복구 가능 여부를 확인하는 중입니다…"}</p>}
        <div className="actions">
          <button className="btn" disabled={restoring} onClick={() => setTarget(null)}>취소</button>
          {step === 1 ? <button className="btn btn-primary" disabled={!preview || restoring} onClick={() => setStep(2)}>다음</button> :
            <button className="btn btn-danger" disabled={!preview || restoring} onClick={confirmRestore}>복구 실행</button>}
        </div>
      </div>
    </Modal>}
  </>;
}
