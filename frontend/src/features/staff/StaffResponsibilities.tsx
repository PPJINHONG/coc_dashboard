import { useEffect, useState } from "react";
import type { DataRow } from "../../shared/api/operations";
import Modal from "../../shared/components/Modal";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { saveResponsibility, type Responsibility, type StaffOptions } from "./api";

import { REGIONS } from "./fields";
export { REGIONS } from "./fields";
const ZONES: Record<string, string> = { KR: "Asia/Seoul", EU: "Europe/Berlin", NA: "America/Los_Angeles" };
const FIELDS = { team_lead: "팀장", group_lead: "그룹장" } as const;
const localTime = (country: string, now: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: ZONES[country], month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
const hhmm = (value?: string | null) => value ? value.slice(0, 5) : "";
const hours = (item?: Responsibility) => item?.work_start && item.work_end ? `${hhmm(item.work_start)}~${hhmm(item.work_end)} KST` : "09:00~18:00 KST (기본값)";

/**
 * 권역 카드: 현지 시각·근무 시간(KST), 등록 인원, 팀장·그룹장. 카드를 누르면 아래 목록·캘린더를 그 권역으로 거릅니다.
 * 권역 설정(팀장·그룹장·근무 시간)은 관리 권역(countries)에만 열리며 서버에서도 같은 범위로 검증합니다.
 */
export default function StaffResponsibilities({ rows, options, countries, revision, refresh, setBusy, region, onRegion }: {
  rows: DataRow[]; options: StaffOptions; countries: string[]; revision: number; refresh: () => Promise<void>; setBusy: (busy: boolean) => void;
  region: string; onRegion: (country: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<Responsibility> | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [version, setVersion] = useState(revision);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => setVersion(revision), [revision]);
  function open(country: string) {
    const item = options.responsibilities.find((row) => row.country_code === country);
    setError("");
    setDraft({ country_code: country, team_lead: item?.team_lead ?? null, group_lead: item?.group_lead ?? null, work_start: hhmm(item?.work_start) || null, work_end: hhmm(item?.work_end) || null });
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
    const count = rows.filter((row) => row.country_code === country).length;
    return <section key={country} className={`staff-region staff-country-${country.toLowerCase()}${region === country ? " is-active" : ""}`}>
      <button type="button" className="staff-region-select" aria-pressed={region === country} onClick={() => onRegion(region === country ? "" : country)}>
        <span className="staff-region-name"><span className="staff-country-badge"><i aria-hidden="true" />{country}</span>{label}</span>
        <span className="staff-region-time">현지 {localTime(country, now)}</span>
        <strong>{count}<small>명</small></strong>
      </button>
      <dl>
        {Object.entries(FIELDS).map(([key, title]) => (
          <div key={key}><dt>{title}</dt><dd>{String(item?.[`${key}_name` as keyof Responsibility] || "미지정")}</dd></div>
        ))}
        <div><dt>근무 시간</dt><dd>{hours(item)}</dd></div>
      </dl>
      {countries.includes(country) && <button className="btn btn-sm" onClick={() => open(country)}>권역 설정</button>}
    </section>;
  })}</div>{draft?.country_code && <Modal title={`${draft.country_code} · ${REGIONS[draft.country_code as keyof typeof REGIONS]} 권역 설정`} onClose={() => { if (!saving) setDraft(null); }}>
    <form className="staff-region-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving} className="staff-person-fields">
        <legend>책임자</legend>
        {Object.entries(FIELDS).map(([key, title]) => <label key={key}>{title}<select aria-label={title} value={String(draft[key as keyof Responsibility] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value ? Number(event.target.value) : null })}><option value="">미지정</option>{rows.filter((row) => key === "team_lead" || row.country_code === draft.country_code).map((row) => <option key={row.id} value={row.id}>{String(row.staff_name)}</option>)}</select></label>)}
      </fieldset>
      <fieldset disabled={saving} className="staff-person-fields">
        <legend>근무 시간 (한국 시간 KST)</legend>
        <label>출근 시간<input type="time" aria-label="출근 시간" value={draft.work_start ?? ""} onChange={(event) => setDraft({ ...draft, work_start: event.target.value || null })} /></label>
        <label>퇴근 시간<input type="time" aria-label="퇴근 시간" value={draft.work_end ?? ""} onChange={(event) => setDraft({ ...draft, work_end: event.target.value || null })} /></label>
        <p className="staff-notice staff-field-wide">다음 권역의 출근 시간을 이 권역의 퇴근 시간으로 입력하세요(예: KR 08:00~17:00, EU 17:00~00:00, NA 00:00~08:00). 퇴근 시간이 출근 시간보다 이르면 자정을 넘기는 근무로 보고, 두 칸을 비우면 09:00~18:00입니다.</p>
      </fieldset>
      <div className="actions"><button type="button" className="btn" disabled={saving} onClick={() => setDraft(null)}>취소</button><button className="btn btn-primary" disabled={saving}>책임자·근무 시간 저장</button></div>
    </form>
    <ErrorMessage message={error} />
  </Modal>}</>;
}
