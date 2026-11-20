import { useEffect, useState } from "react";
import type { DataRow } from "../../shared/api/operations";
import Modal from "../../shared/components/Modal";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { saveResponsibility, type Responsibility, type StaffOptions } from "./api";

export const REGIONS = { KR: "내수", EU: "유럽", NA: "북미" } as const;
const ZONES: Record<string, string> = { KR: "Asia/Seoul", EU: "Europe/Berlin", NA: "America/Los_Angeles" };
const FIELDS = { team_lead: "팀장", group_lead: "그룹장" } as const;
const localTime = (country: string, now: Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: ZONES[country], month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);

/** 권역 카드: 현지 시각, 근무 예정/재직 인원과 비율, 팀장·그룹장. 카드를 누르면 아래 목록·캘린더를 그 권역으로 거릅니다. */
export default function StaffResponsibilities({ rows, options, countries, revision, refresh, setBusy, region, onRegion }: {
  rows: DataRow[]; options: StaffOptions; countries: string[]; revision: number; refresh: () => Promise<void>; setBusy: (busy: boolean) => void;
  region: string; onRegion: (country: string) => void;
}) {
  const [draft, setDraft] = useState<Partial<Responsibility> | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  return <><div className="staff-regions">{Object.entries(REGIONS).map(([country, label]) => {
    const item = options.responsibilities.find((row) => row.country_code === country);
    const people = rows.filter((row) => row.country_code === country && row.work_status !== "retired");
    const scheduled = people.filter((row) => row.work_status === "scheduled").length;
    const ratio = people.length ? Math.round(scheduled / people.length * 100) : 0;
    return <section key={country} className={`staff-region staff-country-${country.toLowerCase()}${region === country ? " is-active" : ""}`}>
      <button type="button" className="staff-region-select" aria-pressed={region === country} onClick={() => onRegion(region === country ? "" : country)}>
        <span className="staff-region-name"><span className="staff-country-badge"><i aria-hidden="true" />{country}</span>{label}</span>
        <span className="staff-region-time">현지 {localTime(country, now)}</span>
        <strong>{scheduled}<small> / {people.length}명</small></strong>
        <span className="staff-region-caption">근무 예정 / 재직</span>
        <span className="staff-progress" role="progressbar" aria-label={`${country} 근무 예정 비율`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio}><i style={{ width: `${ratio}%` }} /></span>
      </button>
      <dl>{Object.entries(FIELDS).map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{item?.[`${key}_name` as keyof Responsibility] || "미지정"}</dd></div>)}</dl>
      {countries.includes(country) && <button className="btn btn-sm" onClick={() => { setError(""); setDraft({ country_code: country, team_lead: item?.team_lead ?? null, group_lead: item?.group_lead ?? null }); }}>팀장·그룹장 설정</button>}
    </section>;
  })}</div>{draft && <Modal title={`${draft.country_code} · ${REGIONS[draft.country_code as keyof typeof REGIONS]} 담당자 설정`} onClose={() => { if (!saving) setDraft(null); }}><form onSubmit={async (event) => { event.preventDefault(); if (saving) return; setSaving(true); setBusy(true); setError(""); try { await saveResponsibility(revision, draft); setDraft(null); await refresh(); } catch (cause) { setError(errorMessage(cause)); } finally { setSaving(false); setBusy(false); } }}>
    <fieldset disabled={saving} className="staff-person-fields">{Object.entries(FIELDS).map(([key, title]) => <label key={key}>{title}<select aria-label={title} value={String(draft[key as keyof Responsibility] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value ? Number(event.target.value) : null })}><option value="">미지정</option>{rows.filter((row) => key === "team_lead" || row.country_code === draft.country_code).map((row) => <option key={row.id} value={row.id}>{String(row.staff_name)} · {String(row.country_code)} · {String(row.company_name || "소속사 미등록")}</option>)}</select></label>)}</fieldset>
    <ErrorMessage message={error} /><div className="actions"><button type="button" className="btn" disabled={saving} onClick={() => setDraft(null)}>취소</button><button className="btn btn-primary" disabled={saving}>저장</button></div>
  </form></Modal>}</>;
}
