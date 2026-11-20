import { useEffect, useState } from "react";
import { sectionRows } from "../../shared/api/operations";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Modal from "../../shared/components/Modal";
import Panel from "../../shared/components/Panel";
import { errorMessage } from "../../shared/errors";
import { calendarEvents, deleteCalendarEvent, saveCalendarEvent, type CalendarEvent, type StaffOptions } from "./api";
import type { StaffPageProps } from "./StaffPage";

const KINDS: Record<string, string> = { leave: "연차", marriage_leave: "결혼휴가" };
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const iso = (date: Date) => date.toISOString().slice(0, 10);
const parse = (day: string) => { const [y, m, d] = day.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (day: string, delta: number) => { const date = parse(day); date.setUTCDate(date.getUTCDate() + delta); return iso(date); };
const weekStart = (day: string) => addDays(day, -((parse(day).getUTCDay() + 6) % 7));
function shiftMonth(month: string, delta: number) { const [y, m] = month.split("-").map(Number); return iso(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7); }
function monthDays(month: string) {
  const first = `${month}-01`, start = weekStart(first);
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (parse(first).getUTCDay() + 6) % 7;
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => addDays(start, i));
}

/** 팀 일정 캘린더. 권역 선택은 인력 현황과 함께 쓰며, 본인 일정만 등록·수정·삭제합니다(서버에서도 검증). */
export default function StaffCalendar({ snapshot, options, refresh, setBusy, setDirty, country, onCountry }: StaffPageProps & { options: StaffOptions; country: string; onCountry: (country: string) => void }) {
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDate, setSelectedDate] = useState(() => { const today = new Date().toLocaleDateString("sv-SE"); return today.startsWith(snapshot.month) ? today : `${snapshot.month}-01`; });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [draft, setDraft] = useState<Partial<CalendarEvent> | null>(null);
  const [saving, setSaving] = useState(false), [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retry, setRetry] = useState(0);
  const month = selectedDate.slice(0, 7);
  const days = view === "month" ? monthDays(month) : Array.from({ length: 7 }, (_, i) => addDays(weekStart(selectedDate), i));
  // 주간 보기가 두 달에 걸치면 두 달을 모두 불러옵니다.
  const months = [...new Set([days[0].slice(0, 7), days[days.length - 1].slice(0, 7), month])];
  const monthsKey = months.join(",");
  const profile = sectionRows(snapshot, "staff").find((person) => person.id === options.my_assignment);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    Promise.all(monthsKey.split(",").map((value) => calendarEvents(value, country)))
      .then((results) => { if (active) setEvents([...new Map(results.flatMap((result) => result.events).map((event) => [event.id, event])).values()]); })
      .catch((cause) => { if (active) { setError(errorMessage(cause)); setEvents([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [monthsKey, country, snapshot.revision, retry]);
  function move(delta: number) { setSelectedDate(view === "month" ? `${shiftMonth(month, delta)}-01` : addDays(selectedDate, delta * 7)); }
  function open(event?: CalendarEvent) { setFormError(""); setConfirmDelete(false); setDraft(event ?? { kind: "leave", title: "", start_date: selectedDate, end_date: selectedDate, can_edit: true }); }
  function close() { if (!saving) { setDraft(null); setDirty(false); } }
  async function save(deleting = false) {
    if (!draft || saving || draft.can_edit === false) return;
    setSaving(true); setBusy(true); setFormError("");
    try {
      if (deleting && draft.id) await deleteCalendarEvent(snapshot.revision, draft.id);
      else await saveCalendarEvent(snapshot.revision, { ...(draft.id ? { id: draft.id } : {}), kind: draft.kind, title: draft.title, start_date: draft.start_date, end_date: draft.end_date });
    } catch (cause) { setFormError(errorMessage(cause)); setSaving(false); setBusy(false); return; }
    setDraft(null); setDirty(false);
    try { await refresh(); } catch { setError("저장은 완료했지만 최신 목록을 불러오지 못했습니다. 새로고침해 주세요."); }
    finally { setSaving(false); setBusy(false); setRetry((value) => value + 1); }
  }
  const on = (day: string) => events.filter((event) => event.start_date <= day && event.end_date >= day);
  const dailyEvents = on(selectedDate);
  const limit = view === "month" ? 3 : 20;
  const title = view === "month" ? `${month.replace("-", "년 ")}월` : `${days[0]} ~ ${days[6]}`;
  return <Panel title="팀 일정" subtitle="권역 현지 날짜 기준 · 일정은 종일 단위입니다." action={<div className="actions staff-calendar-actions">
    <div className="staff-chips" role="group" aria-label="캘린더 보기">{([["month", "월간"], ["week", "주간"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div>
    <div className="staff-chips" role="group" aria-label="캘린더 권역">{[["", "전체"], ["KR", "KR"], ["EU", "EU"], ["NA", "NA"]].map(([value, label]) => <button type="button" key={value} aria-pressed={country === value} onClick={() => onCountry(value)}>{label}</button>)}</div>
    {options.can_edit_calendar && <button className="btn btn-primary" onClick={() => open()}>일정 추가</button>}
  </div>}>
    <div className="staff-calendar-nav">
      <button className="btn btn-sm" aria-label={view === "month" ? "이전 달" : "이전 주"} onClick={() => move(-1)}>이전</button>
      <strong>{title}</strong>
      <button className="btn btn-sm" aria-label={view === "month" ? "다음 달" : "다음 주"} onClick={() => move(1)}>다음</button>
      <input type="date" aria-label="날짜 이동" value={selectedDate} onChange={(event) => { if (event.target.value) setSelectedDate(event.target.value); }} />
    </div>
    {!options.my_assignment && <p className="staff-notice staff-calendar-note">본인 일정 등록은 운영 인력과 회원 계정이 연결된 뒤 사용할 수 있습니다.</p>}
    <ErrorMessage message={error} />{error && <button className="btn" onClick={() => setRetry(retry + 1)}>다시 불러오기</button>}
    {loading && <p role="status" className="staff-notice staff-calendar-note">일정을 불러오고 있습니다…</p>}
    <div className="staff-calendar-scroll"><div className={`staff-calendar-grid${view === "week" ? " is-week" : ""}`} role="group" aria-label={`${title} 일정 캘린더`}>
      {DAYS.map((day) => <div key={day} className="staff-calendar-weekday">{day}</div>)}
      {days.map((day) => { const outside = view === "month" && !day.startsWith(month); const items = on(day); return <div key={day} className={`staff-calendar-day${outside ? " outside" : ""}${day === selectedDate ? " selected" : ""}`}>
        <button className="staff-calendar-date" disabled={outside || loading} aria-label={`${day} 일정 보기`} aria-pressed={day === selectedDate} onClick={() => setSelectedDate(day)}>{view === "week" ? `${Number(day.slice(5, 7))}/${Number(day.slice(-2))}` : Number(day.slice(-2))}</button>
        {!outside && !loading && items.slice(0, limit).map((event) => <button key={event.id} className={`staff-calendar-event kind-${event.kind}`} onClick={() => open(event)} title={`${event.staff_name} · ${KINDS[event.kind] ?? event.kind} · ${event.start_date}~${event.end_date}`}><span>{event.country_code}</span> {event.staff_name} · {KINDS[event.kind] ?? event.kind}</button>)}
        {!outside && !loading && items.length > limit && <button className="staff-calendar-more" onClick={() => setSelectedDate(day)}>+{items.length - limit}개 더 보기</button>}
      </div>; })}
    </div></div>
    <div className="staff-calendar-legend" aria-label="일정 유형">{Object.entries(KINDS).map(([value, label]) => <span key={value} className={`kind-${value}`}><i aria-hidden="true" />{label}</span>)}</div>
    <h3 className="staff-agenda-title">{selectedDate} 일정 {dailyEvents.length}건</h3>
    <div className="report-table-scroll staff-agenda"><table className="report-table"><thead><tr>{["사용자", "권역", "유형", "기간", "설명", ""].map((label, index) => <th scope="col" key={index}>{label}</th>)}</tr></thead>
      <tbody>{dailyEvents.map((event) => <tr key={event.id}><th scope="row">{event.staff_name}</th><td>{event.country_code}</td><td><span className={`staff-kind kind-${event.kind}`}><i aria-hidden="true" />{KINDS[event.kind] ?? event.kind}</span></td><td>{event.start_date === event.end_date ? event.start_date : `${event.start_date} ~ ${event.end_date}`} · 종일</td><td>{event.title || "—"}</td><td><button className="btn btn-sm" onClick={() => open(event)}>{event.can_edit ? "수정" : "상세"}</button></td></tr>)}
        {!loading && !dailyEvents.length && <tr><td colSpan={6} className="staff-empty">등록된 일정이 없습니다.</td></tr>}</tbody></table></div>
    {draft && <Modal title={draft.id ? "일정" : "일정 추가"} onClose={close}><form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p className="staff-notice">{String(draft.staff_name ?? profile?.staff_name ?? "")} · {String(draft.country_code ?? profile?.country_code ?? "")}</p>
      <fieldset className="staff-person-fields" disabled={saving || draft.can_edit === false}>
        <label className="staff-field-wide">일정 종류<select value={draft.kind} aria-label="일정 종류" onChange={(event) => { setDraft({ ...draft, kind: event.target.value }); setDirty(true); }}>{Object.entries(KINDS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>시작일<input type="date" required aria-label="일정 시작일" value={draft.start_date} onChange={(event) => { setDraft({ ...draft, start_date: event.target.value }); setDirty(true); }} /></label>
        <label>종료일<input type="date" required min={draft.start_date} aria-label="일정 종료일" value={draft.end_date} onChange={(event) => { setDraft({ ...draft, end_date: event.target.value }); setDirty(true); }} /></label>
        <label className="staff-field-wide">상세 내용 (선택)<input maxLength={100} value={draft.title} aria-label="일정 상세 내용" onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setDirty(true); }} /></label>
      </fieldset>
      {draft.can_edit === false && <p className="staff-notice">본인의 일정만 수정할 수 있습니다.</p>}
      <ErrorMessage message={formError} />
      {confirmDelete && <p role="alert">이 일정을 삭제하시겠습니까?</p>}
      <div className="actions">{draft.id && draft.can_edit && <button type="button" className="btn btn-danger" disabled={saving} onClick={() => { if (confirmDelete) void save(true); else setConfirmDelete(true); }}>{confirmDelete ? "삭제 확인" : "일정 삭제"}</button>}<button type="button" className="btn" disabled={saving} onClick={close}>닫기</button>{draft.can_edit && <button className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : draft.id ? "저장" : "등록"}</button>}</div>
    </form></Modal>}
  </Panel>;
}
