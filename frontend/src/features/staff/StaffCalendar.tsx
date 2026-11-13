import { useEffect, useState } from "react";
import { sectionRows } from "../../shared/api/operations";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Modal from "../../shared/components/Modal";
import Panel from "../../shared/components/Panel";
import { errorMessage } from "../../shared/errors";
import { calendarEvents, deleteCalendarEvent, saveCalendarEvent, type CalendarEvent, type StaffOptions } from "./api";
import type { StaffPageProps } from "./StaffPage";

const KINDS: Record<string, string> = { leave: "휴가", marriage_leave: "결혼휴가", long_leave: "장기휴가" };
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const iso = (date: Date) => date.toISOString().slice(0, 10);
function shiftMonth(month: string, delta: number) { const [y, m] = month.split("-").map(Number); return iso(new Date(Date.UTC(y, m - 1 + delta, 1))).slice(0, 7); }
function monthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => iso(new Date(Date.UTC(y, m - 1, i - offset + 1))));
}

export default function StaffCalendar({ snapshot, options, refresh, setBusy, setDirty }: StaffPageProps & { options: StaffOptions }) {
  const [month, setMonth] = useState(snapshot.month);
  const [country, setCountry] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(`${snapshot.month}-01`);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [draft, setDraft] = useState<Partial<CalendarEvent> | null>(null);
  const [saving, setSaving] = useState(false), [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retry, setRetry] = useState(0);
  const profile = sectionRows(snapshot, "staff").find((person) => person.id === options.my_assignment);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    calendarEvents(month, country).then((value) => { if (active) setEvents(value.events); })
      .catch((cause) => { if (active) { setError(errorMessage(cause)); setEvents([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, country, snapshot.revision, retry]);
  function changeMonth(value: string) { setMonth(value); setSelectedDate(`${value}-01`); }
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
  const dailyEvents = events.filter((event) => event.start_date <= selectedDate && event.end_date >= selectedDate);
  return <div className="report-sections staff-calendar-page">
    <header className="section-head"><div><h1>인력 캘린더</h1><p className="section-sub">전체 권역의 휴가 일정 · 권역 현지 날짜 기준</p></div>{options.can_edit_calendar && <button className="btn btn-primary" onClick={() => open()}>내 일정 등록</button>}</header>
    <nav className="staff-country-tabs" aria-label="캘린더 권역">{[["", "전체 권역"], ["KR", "KR · 내수"], ["EU", "EU · 유럽"], ["NA", "NA · 북미"]].map(([value, label]) => <button key={value} aria-pressed={country === value} onClick={() => setCountry(value)}>{label}</button>)}</nav>
    {!options.my_assignment && <p className="staff-notice">본인 일정 등록은 관리자·팀장이 운영 인력의 회원 계정을 연결한 뒤 사용할 수 있습니다.</p>}
    <ErrorMessage message={error} />{error && <button className="btn" onClick={() => setRetry(retry + 1)}>다시 불러오기</button>}
    <Panel title={`${month.replace("-", "년 ")}월`} action={<div className="actions"><button className="btn btn-sm" aria-label="캘린더 이전 달" onClick={() => changeMonth(shiftMonth(month, -1))}>이전 달</button><input type="month" aria-label="캘린더 월" value={month} onChange={(event) => { if (event.target.value) changeMonth(event.target.value); }} /><button className="btn btn-sm" aria-label="캘린더 다음 달" onClick={() => changeMonth(shiftMonth(month, 1))}>다음 달</button></div>}>
      {loading && <p role="status" className="staff-notice">일정을 불러오고 있습니다…</p>}
      <div className="staff-calendar-scroll"><div className="staff-calendar-grid" role="group" aria-label={`${month} 휴가 캘린더`}>
        {DAYS.map((day) => <div key={day} className="staff-calendar-weekday">{day}</div>)}
        {monthDays(month).map((day) => { const outside = !day.startsWith(month); const items = events.filter((event) => event.start_date <= day && event.end_date >= day); return <div key={day} className={`staff-calendar-day${outside ? " outside" : ""}${day === selectedDate ? " selected" : ""}`}>
          <button className="staff-calendar-date" disabled={outside || loading} aria-label={`${day} 일정 보기`} aria-pressed={day === selectedDate} onClick={() => setSelectedDate(day)}>{Number(day.slice(-2))}</button>
          {!outside && !loading && items.slice(0, 3).map((event) => <button key={event.id} className={`staff-calendar-event country-${event.country_code.toLowerCase()}`} onClick={() => open(event)} title={`${event.staff_name} · ${KINDS[event.kind]} · ${event.start_date}~${event.end_date}`}><span>{event.country_code}</span> {event.staff_name} · {KINDS[event.kind]}</button>)}
          {!outside && !loading && items.length > 3 && <button className="staff-calendar-more" onClick={() => setSelectedDate(day)}>+{items.length - 3}개 더 보기</button>}
        </div>; })}
      </div></div>
    </Panel>
    <Panel title={`${selectedDate} 일정`}><div className="staff-calendar-agenda">{!loading && !dailyEvents.length && <p>등록된 일정이 없습니다.</p>}{dailyEvents.map((event) => <button key={event.id} className="staff-calendar-agenda-item" onClick={() => open(event)}><strong>{event.country_code} · {event.staff_name}</strong><span>{KINDS[event.kind]}{event.title ? ` · ${event.title}` : ""}</span><span>{event.start_date} ~ {event.end_date}</span><span>{event.can_edit ? "수정" : "상세 보기"}</span></button>)}</div></Panel>
    {draft && <Modal title={draft.id ? "휴가 일정" : "내 일정 등록"} onClose={close}><form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p className="staff-notice">{String(draft.staff_name ?? profile?.staff_name ?? "")} · {String(draft.country_code ?? profile?.country_code ?? "")}</p>
      <fieldset className="staff-person-fields" disabled={saving || draft.can_edit === false}>
        <label className="staff-field-wide">일정 종류<select value={draft.kind} aria-label="일정 종류" onChange={(event) => { setDraft({ ...draft, kind: event.target.value }); setDirty(true); }}>{Object.entries(KINDS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>시작일<input type="date" required aria-label="일정 시작일" value={draft.start_date} onChange={(event) => { setDraft({ ...draft, start_date: event.target.value }); setDirty(true); }} /></label>
        <label>종료일<input type="date" required min={draft.start_date} aria-label="일정 종료일" value={draft.end_date} onChange={(event) => { setDraft({ ...draft, end_date: event.target.value }); setDirty(true); }} /></label>
        <label className="staff-field-wide">제목 (선택)<input maxLength={100} value={draft.title} aria-label="일정 제목" onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setDirty(true); }} /></label>
      </fieldset>
      {draft.can_edit === false && <p className="staff-notice">본인의 일정만 수정할 수 있습니다.</p>}
      <ErrorMessage message={formError} />
      {confirmDelete && <p role="alert">이 일정을 삭제하시겠습니까?</p>}
      <div className="actions">{draft.id && draft.can_edit && <button type="button" className="btn btn-danger" disabled={saving} onClick={() => { if (confirmDelete) void save(true); else setConfirmDelete(true); }}>{confirmDelete ? "삭제 확인" : "일정 삭제"}</button>}<button type="button" className="btn" disabled={saving} onClick={close}>닫기</button>{draft.can_edit && <button className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : draft.id ? "저장" : "등록"}</button>}</div>
    </form></Modal>}
  </div>;
}
