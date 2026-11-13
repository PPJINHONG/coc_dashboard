import { useState } from "react";
import type { DataRow } from "../../shared/api/operations";
import Modal from "../../shared/components/Modal";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { saveResponsibility, type Responsibility, type StaffOptions } from "./api";

const LABELS = { KR: "내수 · KR", EU: "유럽 · EU", NA: "북미 · NA" };
const FIELDS = { site_representative: "현장대리인", team_lead: "팀장", group_lead: "그룹장" } as const;
export default function StaffResponsibilities({ rows, options, countries, revision, refresh, setBusy }: { rows: DataRow[]; options: StaffOptions; countries: string[]; revision: number; refresh: () => Promise<void>; setBusy: (busy: boolean) => void }) {
  const [draft, setDraft] = useState<Partial<Responsibility> | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  return <><div className="staff-responsibilities">{Object.entries(LABELS).map(([country, label]) => {
    const item = options.responsibilities.find((row) => row.country_code === country);
    return <section key={country}><header><h2>{label}</h2>{countries.includes(country) && <button className="btn btn-sm" onClick={() => { setError(""); setDraft(item ?? { country_code: country, site_representative: null, team_lead: null, group_lead: null }); }}>담당자 설정</button>}</header>
      <dl>{Object.entries(FIELDS).map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{item?.[`${key}_name` as keyof Responsibility] || "미지정"}</dd></div>)}</dl>
    </section>;
  })}</div>{draft && <Modal title={`${LABELS[draft.country_code as keyof typeof LABELS]} 담당자 설정`} onClose={() => { if (!saving) setDraft(null); }}><form onSubmit={async (event) => { event.preventDefault(); if (saving) return; setSaving(true); setBusy(true); setError(""); try { await saveResponsibility(revision, draft); setDraft(null); await refresh(); } catch (cause) { setError(errorMessage(cause)); } finally { setSaving(false); setBusy(false); } }}>
    <fieldset disabled={saving} className="staff-person-fields">{Object.entries(FIELDS).map(([key, title]) => <label key={key}>{title}<select aria-label={title} value={String(draft[key as keyof Responsibility] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value ? Number(event.target.value) : null })}><option value="">미지정</option>{rows.filter((row) => key === "team_lead" || row.country_code === draft.country_code).map((row) => <option key={row.id} value={row.id}>{String(row.staff_name)} · {String(row.country_code)} · {String(row.company_name || "소속사 미등록")}</option>)}</select></label>)}</fieldset>
    <ErrorMessage message={error} /><div className="actions"><button type="button" className="btn" disabled={saving} onClick={() => setDraft(null)}>취소</button><button className="btn btn-primary" disabled={saving}>저장</button></div>
  </form></Modal>}</>;
}
