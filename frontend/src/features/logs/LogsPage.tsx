import { useCallback, useEffect, useRef, useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Modal from "../../shared/components/Modal";
import { errorMessage } from "../../shared/errors";
import { localDate } from "../../shared/fields";
import * as api from "./api";
import type { HistoryLog, HistoryPage, RestorePreview } from "./api";
import LogList from "./LogList";

export default function LogsPage({ data, snapshot, user, features, refresh, setBusy }: FeaturePageProps) {
  const labels = Object.fromEntries([
    ...features.map((item) => [item.id, item.label]),
    ["regions", "리전 공통데이터"], ["services", "서비스 공통데이터"], ["staff-members", "인력 공통데이터"],
  ]);
  const [section, setSection] = useState("");
  const [region, setRegion] = useState("");
  const [actor, setActor] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(false);
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [catalog, setCatalog] = useState<Pick<HistoryPage, "tabs" | "actors" | "regions"> | null>(null);
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
  const month = selectedMonth ? snapshot.month : "";
  const fetchPage = useCallback((offset = "") => api.history({ section, region, actor, month, offset }), [section, region, actor, month]);
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
  const scope = user?.is_staff || user?.role === "team_lead" ? "전체 변경 이력" :
    user?.role === "group_lead" ? `${(user.managed_countries ?? []).join(" · ")} 관리 권역의 변경 이력` : "본인이 변경한 이력";
  return <>
    <header className="page-heading">
      <div><span className="eyebrow">ACTIVITY</span><h1>변경 이력</h1><p>{scope}을 최신순으로 확인합니다.</p></div>
      <button className="btn btn-sm" disabled={loading || restoring} onClick={() => setReload((value) => value + 1)}>새로고침</button>
    </header>
    <section className="panel logs-filters" aria-label="변경 이력 필터">
      <label>리전<select value={region} disabled={restoring} onChange={(event) => setRegion(event.target.value)}>
        <option value="">전체 리전</option>{catalog?.regions.map((item) => <option key={item.id} value={item.id}>{item.region_name}</option>)}
      </select></label>
      <label>사용자<select value={actor} disabled={restoring} onChange={(event) => setActor(event.target.value)}>
        <option value="">전체 사용자</option>{catalog?.actors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>기준 월<select value={selectedMonth ? "selected" : "all"} disabled={restoring} onChange={(event) => setSelectedMonth(event.target.value === "selected")}>
        <option value="all">전체 기간</option><option value="selected">{snapshot.month} 월별 데이터</option>
      </select></label>
      <button className="btn btn-sm" disabled={restoring} onClick={() => { setRegion(""); setActor(""); setSection(""); setSelectedMonth(false); }}>필터 초기화</button>
    </section>
    <div className="logs-layout">
      <nav className="panel logs-tabs" aria-label="변경한 기능 선택">
        <button className={`logs-tab${!section ? " active" : ""}`} aria-pressed={!section} disabled={restoring} onClick={() => setSection("")}><strong>전체 변경</strong></button>
        {catalog?.tabs.map((item) => <button key={item.id} className={`logs-tab${section === item.id ? " active" : ""}`} aria-pressed={section === item.id} disabled={restoring} onClick={() => setSection(item.id)}>
          <span><strong>{labels[item.id] ?? item.id}</strong></span>
          <time>{localDate(item.latest_at)}</time>
        </button>)}
        {section && !catalog?.tabs.some((item) => item.id === section) && <button className="logs-tab active" aria-pressed="true" onClick={() => setSection("")}>{labels[section] ?? section}</button>}
      </nav>
      <section className="panel logs-content" aria-label="변경 목록" aria-busy={loading}>
        <div className="logs-list-heading"><h2>{section ? labels[section] ?? section : "전체 변경"}</h2><span>최신순</span></div>
        {notice && <p className="logs-notice" role="status">{notice}</p>}
        <ErrorMessage message={error} />
        {page && <LogList rows={page.results} labels={labels} details data={data} onRestore={user?.is_staff ? openRestore : undefined} />}
        {loading && <p className="report-empty" role="status">변경 이력을 불러오는 중입니다…</p>}
        {!loading && error && !page && <button className="btn" onClick={() => setReload((value) => value + 1)}>다시 시도</button>}
        {page?.next_offset != null && <div className="logs-more"><button className="btn" disabled={loading} onClick={loadMore}>이전 변경 더 보기</button></div>}
      </section>
    </div>
    {target && <Modal title={step === 1 ? "정말 복구하시겠습니까?" : "복구 최종 확인"} onClose={() => { if (!restoring) setTarget(null); }}>
      <div className="logs-restore-body">
        <p><strong>{labels[target.section] ?? target.section}</strong> · {localDate(target.created_at)}</p>
        <p>{target.summary}</p>
        <p>{step === 1 ? "이 변경에서 바뀐 데이터를 변경 전 상태로 되돌립니다." : "한 번 더 확인해 주세요. 아래 확인 버튼을 누르면 복구를 실행합니다."}</p>
        {preview && <p>{preview.month ? `${preview.month} 기준 · ` : ""}관련 데이터 {preview.affected_count}건을 복구하며, 등록한 항목은 삭제되고 삭제한 항목은 복원됩니다.</p>}
        <ErrorMessage message={restoreError} />
        {restoring && <p role="status">{preview ? "복구하는 중입니다…" : "복구 가능 여부를 확인하는 중입니다…"}</p>}
        <div className="actions">
          <button className="btn" disabled={restoring} onClick={() => setTarget(null)}>취소</button>
          {step === 1 ? <button className="btn btn-primary" disabled={!preview || restoring} onClick={() => setStep(2)}>확인 · 다음 단계</button> :
            <button className="btn btn-danger" disabled={!preview || restoring} onClick={confirmRestore}>최종 확인 · 복구 실행</button>}
        </div>
      </div>
    </Modal>}
  </>;
}
