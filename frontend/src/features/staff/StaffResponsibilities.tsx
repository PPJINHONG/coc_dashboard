import { useEffect, useState } from "react";
import type { DataRow } from "../../shared/api/operations";
import Modal from "../../shared/components/Modal";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { addStaffChoice, deleteStaffChoice, saveResponsibility, type Responsibility, type StaffItem, type StaffOptions } from "./api";

export const REGIONS = { KR: "내수", EU: "유럽", NA: "북미" } as const;
const ZONES: Record<string, string> = { KR: "Asia/Seoul", EU: "Europe/Berlin", NA: "America/Los_Angeles" };
const FIELDS = { team_lead: "팀장", group_lead: "그룹장" } as const;
const localTime = (country: string, now: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: ZONES[country], month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
const hhmm = (value?: string | null) => value ? value.slice(0, 5) : "";
const hours = (item?: Responsibility) => item?.work_start && item.work_end ? `${hhmm(item.work_start)}~${hhmm(item.work_end)} KST` : "09:00~18:00 KST (기본값)";

/**
 * 권역 카드: 현지 시각·근무 시간(KST), 출근/재직 인원과 비율, 팀장·그룹장. 카드를 누르면 아래 목록·캘린더를 그 권역으로 거릅니다.
 * 권역 설정(팀장·그룹장·근무 시간·근무지)은 관리 권역(countries)에만 열리며 서버에서도 같은 범위로 검증합니다.
 */
export default function StaffResponsibilities({ rows, options, countries, revision, refresh, setBusy, region, onRegion }: {
  rows: DataRow[]; options: StaffOptions; countries: string[]; revision: number; refresh: () => Promise<void>; setBusy: (busy: boolean) => void;
  region: string; onRegion: (country: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<Responsibility> | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [version, setVersion] = useState(revision);
  const [items, setItems] = useState<StaffItem[]>(options.items);
  const [place, setPlace] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => setVersion(revision), [revision]);
  useEffect(() => setItems(options.items), [options.items]);
  const places = (country: string) => items.find((item) => item.key === "work_location")?.values.filter((item) => item.country_code === country) ?? [];
  function open(country: string) {
    const item = options.responsibilities.find((row) => row.country_code === country);
    setError(""); setPlace("");
    setDraft({ country_code: country, team_lead: item?.team_lead ?? null, group_lead: item?.group_lead ?? null, work_start: hhmm(item?.work_start) || null, work_end: hhmm(item?.work_end) || null });
  }
  async function changePlace(remove?: number) {
    if (!draft?.country_code || saving || (remove === undefined && !place.trim())) return;
    setSaving(true); setBusy(true); setError("");
    try {
      const result = remove !== undefined ? await deleteStaffChoice(version, remove)
        : await addStaffChoice(version, { kind: "work_location", country_code: draft.country_code, value: place.trim() });
      setVersion(result.revision); setItems(result.items); setPlace("");
      await refresh().catch(() => setError("저장은 완료됐지만 화면을 갱신하지 못했습니다. 다시 불러와 주세요."));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); setBusy(false); }
  }
  async function save() {
    if (!draft || saving) return;
    setSaving(true); setBusy(true); setError("");
    try { await saveResponsibility(version, draft); setDraft(null); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); setBusy(false); }
  }
  return <><div className="staff-regions">{Object.entries(REGIONS).map(([country, label]) => {
    const item = options.responsibilities.find((row) => row.country_code === country);
    const people = rows.filter((row) => row.country_code === country && row.work_status !== "retired");
    const working = people.filter((row) => row.work_status === "on_duty").length;
    const ratio = people.length ? Math.round(working / people.length * 100) : 0;
    return <section key={country} className={`staff-region staff-country-${country.toLowerCase()}${region === country ? " is-active" : ""}`}>
      <button type="button" className="staff-region-select" aria-pressed={region === country} onClick={() => onRegion(region === country ? "" : country)}>
        <span className="staff-region-name"><span className="staff-country-badge"><i aria-hidden="true" />{country}</span>{label}</span>
        <span className="staff-region-time">현지 {localTime(country, now)}</span>
        <strong>{working}<small> / {people.length}명</small></strong>
        <span className="staff-region-caption">출근 / 재직</span>
        <span className="staff-progress" role="progressbar" aria-label={`${country} 출근 비율`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio}><i style={{ width: `${ratio}%` }} /></span>
      </button>
      <dl>
        {Object.entries(FIELDS).map(([key, title]) => {
          // 권역 설정의 지정과 직책(팀장·그룹장)을 함께 보여 줍니다. 그룹장이 여럿이면 근무지와 함께 모두 표시합니다.
          const assigned = String(item?.[`${key}_name` as keyof Responsibility] ?? "");
          const titled = rows.filter((row) => row.country_code === country && row.display_role === key).map((row) => `${String(row.staff_name)}${row.work_location ? ` (${String(row.work_location)})` : ""}`);
          const names = [...new Set([...(assigned && !titled.some((name) => name.startsWith(assigned)) ? [assigned] : []), ...titled])];
          return <div key={key}><dt>{title}</dt><dd>{names.join(", ") || "미지정"}</dd></div>;
        })}
        <div><dt>근무 시간</dt><dd>{hours(item)}</dd></div>
        {countries.includes(country) && <div><dt>근무지</dt><dd>{places(country).map((entry) => entry.value).join(", ") || "미등록"}</dd></div>}
      </dl>
      {countries.includes(country) && <button className="btn btn-sm" onClick={() => open(country)}>권역 설정</button>}
    </section>;
  })}</div>{draft?.country_code && <Modal title={`${draft.country_code} · ${REGIONS[draft.country_code as keyof typeof REGIONS]} 권역 설정`} onClose={() => { if (!saving) setDraft(null); }}>
    <form className="staff-region-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving} className="staff-person-fields">
        <legend>책임자</legend>
        {Object.entries(FIELDS).map(([key, title]) => <label key={key}>{title}<select aria-label={title} value={String(draft[key as keyof Responsibility] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value ? Number(event.target.value) : null })}><option value="">미지정</option>{rows.filter((row) => key === "team_lead" || row.country_code === draft.country_code).map((row) => <option key={row.id} value={row.id}>{String(row.staff_name)} · {String(row.country_code)} · {String(row.company_name || "소속사 미등록")}</option>)}</select></label>)}
      </fieldset>
      <fieldset disabled={saving} className="staff-person-fields">
        <legend>근무 시간 (한국 시간 KST)</legend>
        <label>출근 시간<input type="time" aria-label="출근 시간" value={draft.work_start ?? ""} onChange={(event) => setDraft({ ...draft, work_start: event.target.value || null })} /></label>
        <label>퇴근 시간<input type="time" aria-label="퇴근 시간" value={draft.work_end ?? ""} onChange={(event) => setDraft({ ...draft, work_end: event.target.value || null })} /></label>
        <p className="staff-notice staff-field-wide">다음 권역의 출근 시간을 이 권역의 퇴근 시간으로 입력하세요(예: KR 08:00~17:00, EU 17:00~00:00, NA 00:00~08:00). 퇴근 시간이 출근 시간보다 이르면 자정을 넘기는 근무로 보고, 두 칸을 비우면 09:00~18:00입니다.</p>
      </fieldset>
      <div className="actions"><button type="button" className="btn" disabled={saving} onClick={() => setDraft(null)}>취소</button><button className="btn btn-primary" disabled={saving}>책임자·근무 시간 저장</button></div>
    </form>
    <section className="staff-region-places" aria-label="근무지">
      <h3>근무지 <small>이 권역 인력의 근무지 선택지 · 바로 저장됩니다</small></h3>
      <ul>{places(draft.country_code).map((entry) => <li key={entry.value}><span>{entry.value}{entry.uses > 0 && <small> · {entry.uses}명 사용 중</small>}</span>
        {entry.choice_id !== null ? <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void changePlace(entry.choice_id!)}>삭제</button> : <small>기존 인력 값</small>}</li>)}
        {!places(draft.country_code).length && <li>등록된 근무지가 없습니다.</li>}</ul>
      <form className="staff-item-add" onSubmit={(event) => { event.preventDefault(); void changePlace(); }}>
        <label>추가할 근무지<input aria-label="추가할 근무지" maxLength={150} value={place} disabled={saving} onChange={(event) => setPlace(event.target.value)} /></label>
        <button className="btn" disabled={saving || !place.trim() || places(draft.country_code).some((entry) => entry.value === place.trim() && entry.choice_id !== null)}>근무지 추가</button>
      </form>
      <p className="staff-notice">근무지를 삭제해도 이미 저장된 인력의 근무지는 바뀌지 않습니다.</p>
    </section>
    <ErrorMessage message={error} />
  </Modal>}</>;
}
