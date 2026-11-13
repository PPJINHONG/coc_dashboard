import { useState } from "react";
import { sectionRows, type DataRow } from "../../shared/api/operations";
import { ApiError } from "../../shared/api/client";
import ErrorMessage from "../../shared/components/ErrorMessage";
import FieldInput from "../../shared/components/FieldInput";
import Modal from "../../shared/components/Modal";
import SectionPage from "../../shared/sections/SectionPage";
import { saveStaffPerson, type StaffOptions } from "./api";
import { staffEditFields, staffFields } from "./fields";
import StaffTable from "./StaffTable";
import Panel from "../../shared/components/Panel";
import type { Field } from "../../shared/fields";
import type { StaffPageProps } from "./StaffPage";
import StaffResponsibilities from "./StaffResponsibilities";
import StaffChoices from "./StaffChoices";

export default function StaffDirectory({ section, data, snapshot, user, refresh, setDirty, setBusy, options }: StaffPageProps & { options: StaffOptions }) {
  const [draft, setDraft] = useState<DataRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [choicesOpen,setChoicesOpen] = useState(false);
  const countries = user?.staff_edit_countries ?? [];
  const rows = sectionRows(snapshot, "staff");
  const [managed, setManaged] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const allColumns = staffFields(data, options.can_view_grade);
  const [hidden, setHidden] = useState<string[]>(["pc_ip", "autoever_account", "z_account", "account_name"]);
  const columns = allColumns.filter((field) => !hidden.includes(field.key));
  const [page, setPage] = useState(1);
  const available = (kind:string,country:string) => options.choices.filter(item=>item.kind===kind&&(kind!=="work_location"||item.country_code===country));
  const firstChoice = (kind:string,country:string) => available(kind,country)[0]?.value??"";
  const fields: Field[] = [
    ...staffEditFields(countries, user?.is_staff ? "admin" : user?.role, String(draft?.job_title ?? "")),
    ...(options.can_view_grade ? [
      { key: "grade", label: "등급", type: "select" as const, nullable: true, default: "", options: [{ value: "", label: "미등록" }, ...["L1", "L2", "L3", "L4"].map((value) => ({ value, label: value }))] },
      { key: "account", label: "회원 계정 연결", type: "select" as const, nullable: true, numberValue: true, options: [{ value: "", label: "미연결" }, ...options.accounts.filter((account) => !rows.some((person) => person.account === account.id && person.id !== draft?.id)).map((account) => ({ value: String(account.id), label: `${account.name} (${account.username})` }))] },
    ] : []),
  ].filter((field) => managed || ["staff_name", "job_description", "work_location", "pc_ip", "autoever_account", "z_account"].includes(field.key)).map(field=>{
    if(!["company_name","work_location"].includes(field.key)) return field;
    const values=available(field.key,String(draft?.country_code??rows.find(person=>person.id===draft?.id)?.country_code??countries[0]??"KR")).map(item=>item.value);
    const current=String(draft?.[field.key]??"");
    if(current&&!values.includes(current)) values.push(current);
    return {...field,type:"select" as const,options:[{value:"",label:"미등록"},...values.map(value=>({value,label:value}))]};
  });
  const filtered = rows.filter((person) => Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    if (key.endsWith("_from") || key.endsWith("_to")) {
      const field = key.replace(/_(from|to)$/, "");
      const actual = String(person[field] ?? "");
      return Boolean(actual) && (key.endsWith("_from") ? actual >= value : actual <= value);
    }
    return String(person[key] ?? "") === value;
  }));
  const setFilter = (key: string, value: string) => { setFilters({ ...filters, [key]: value }); setPage(1); };
  function open(person?: DataRow) {
    setError("");
    const canManage = !person || person.can_manage === true;
    setManaged(canManage);
    const editFields = canManage ? staffEditFields(countries, user?.is_staff ? "admin" : user?.role, String(person?.job_title ?? "")) : fields.filter((field) => ["staff_name", "job_description", "work_location", "pc_ip", "autoever_account", "z_account"].includes(field.key));
    const keys = [...editFields.map((field) => field.key), ...(canManage && options.can_view_grade ? ["grade", "account"] : [])];
    setDraft(person ? Object.fromEntries(["id", ...keys].map((key) => [key, person[key] ?? (key.endsWith("_date") || key === "account" ? null : "")])) : {
      ...Object.fromEntries(editFields.map((field) => [field.key, field.default ?? (field.nullable ? null : "")])),
      work_location: firstChoice("work_location",countries[0]),
      company_name: firstChoice("company_name",countries[0]),
      ...(options.can_view_grade ? { grade: "", account: null } : {}),
    });
  }
  function close() {
    if (saving) return;
    setDraft(null);
    setDirty(false);
  }
  async function save() {
    if (!draft || saving) return;
    if (!String(draft.staff_name ?? "").trim()) { setError("성명을 입력해 주세요."); return; }
    setSaving(true);
    setBusy(true);
    setError("");
    try {
      await saveStaffPerson(snapshot.revision, draft);
    } catch (cause) {
      setError(cause instanceof ApiError ? [cause.message, ...Object.values(cause.fieldErrors).flat()].join(" ") : "저장하지 못했습니다.");
      setSaving(false);
      setBusy(false);
      return;
    }
    setDraft(null);
    setDirty(false);
    try { await refresh(); setRefreshError(""); }
    catch { setRefreshError("저장은 완료했지만 목록을 갱신하지 못했습니다. 새로고침해 주세요."); }
    finally { setSaving(false); setBusy(false); }
  }
  return (
    <SectionPage config={{ ...section, fields: () => columns }} rows={filtered} data={data}
      subtitle="한국 · 미국 · 유럽 운영 인력"
      actions={<div className="actions">{options.can_manage_choices&&<button className="btn" onClick={()=>setChoicesOpen(true)}>선택지 관리</button>}{countries.length > 0 && <button className="btn btn-primary" onClick={() => open()}>운영 인력 추가</button>}</div>}
      renderBody={(visible) => <>
        <StaffResponsibilities rows={rows} options={options} countries={countries} revision={snapshot.revision} refresh={refresh} setBusy={setBusy} />
        <Panel title="운영 인력 목록">
          <div className="staff-directory-filters">
            {["global_region", "company_name", "job_title", "employment_status", "current_status", ...(options.can_view_grade ? ["grade"] : [])].map((key) => <label key={key}>{allColumns.find((field) => field.key === key)?.label}<select value={filters[key] ?? ""} onChange={(event) => setFilter(key, event.target.value)}><option value="">전체</option>{[...new Set(rows.map((person) => String(person[key] ?? "")).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value === "employed" ? "재직중" : value === "retired" ? "퇴사" : value}</option>)}</select></label>)}
            {[["deployment_date", "투입일"], ["resignation_date", "회사 퇴사일"]].map(([key, label]) => <fieldset className="staff-date-range" key={key}><legend>{label}</legend><input type="date" aria-label={`${label} 시작`} value={filters[`${key}_from`] ?? ""} onChange={(event) => setFilter(`${key}_from`, event.target.value)} /><span>~</span><input type="date" aria-label={`${label} 끝`} value={filters[`${key}_to`] ?? ""} onChange={(event) => setFilter(`${key}_to`, event.target.value)} /></fieldset>)}
            <button className="btn btn-sm" onClick={() => { setFilters({}); setPage(1); }}>필터 초기화</button>
            <details className="staff-column-picker"><summary>표시 컬럼</summary><div>{allColumns.map((field) => <label key={field.key}><input type="checkbox" checked={!hidden.includes(field.key)} disabled={["country_code", "staff"].includes(field.key)} onChange={(event) => setHidden(event.target.checked ? hidden.filter((key) => key !== field.key) : [...hidden, field.key])} />{field.label}</label>)}</div></details>
          </div>
          <StaffTable rows={visible.slice((Math.min(page, Math.max(1, Math.ceil(visible.length / 30))) - 1) * 30, Math.min(page, Math.max(1, Math.ceil(visible.length / 30))) * 30)} columns={columns} data={data} onEdit={rows.some((person) => person.can_edit) ? open : undefined} />
          <div className="staff-pagination"><span>{visible.length}명</span><div className="actions"><button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(Math.max(1, Math.min(page, Math.ceil(visible.length / 30)) - 1))}>이전</button><span>{Math.min(page, Math.max(1, Math.ceil(visible.length / 30)))} / {Math.max(1, Math.ceil(visible.length / 30))}</span><button className="btn btn-sm" disabled={page >= Math.ceil(visible.length / 30)} onClick={() => setPage(page + 1)}>다음</button></div></div>
        </Panel>
      </>}>
      <ErrorMessage message={refreshError} />
      {choicesOpen&&<StaffChoices choices={options.choices} revision={snapshot.revision} refresh={refresh} setBusy={setBusy} onClose={()=>setChoicesOpen(false)}/>}
      {draft && <Modal title={draft.id ? "운영 인력 정보 수정" : "운영 인력 추가"} onClose={close}>
        <form className="staff-person-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={saving} className="staff-person-fields">
            {fields.map((field) => <label key={field.key} className={field.type === "textarea" ? "staff-field-wide" : ""}>
              <span>{field.label}{["staff_name", "country_code"].includes(field.key) && " *"}</span>
              {field.key.endsWith("_date") ? <input type="date" aria-label={field.label} value={String(draft[field.key] ?? "")} onChange={(event) => { setDraft({ ...draft, [field.key]: event.target.value || null }); setDirty(true); }} /> : <FieldInput field={field} value={draft[field.key]} label={field.label} onChange={(value) => {
                setDraft({ ...draft, [field.key]: field.key === "grade" && value === null ? "" : value, ...(field.key === "country_code" ? { work_location: firstChoice("work_location",String(value)) } : {}) });
                setDirty(true);
              }} />}
            </label>)}
          </fieldset>
          <ErrorMessage message={error} />
          <div className="actions"><button type="button" className="btn" disabled={saving} onClick={close}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : draft.id ? "저장" : "등록"}</button></div>
        </form>
      </Modal>}
    </SectionPage>
  );
}
