import { useState } from "react";
import { sectionRows, type DataRow } from "../../shared/api/operations";
import { ApiError } from "../../shared/api/client";
import ErrorMessage from "../../shared/components/ErrorMessage";
import FieldInput from "../../shared/components/FieldInput";
import Modal from "../../shared/components/Modal";
import { saveStaffPerson, saveResponsibility, type StaffOptions } from "./api";
import { staffEditFields, staffFields, WORK_STATUSES } from "./fields";
import { exportCsv } from "../../shared/fields";
import StaffCalendar from "./StaffCalendar";
import StaffTable from "./StaffTable";
import Panel from "../../shared/components/Panel";
import type { Field } from "../../shared/fields";
import type { StaffPageProps } from "./StaffPage";
import StaffResponsibilities, { REGIONS } from "./StaffResponsibilities";
import StaffChoices from "./StaffChoices";

export default function StaffDirectory(props: StaffPageProps & { options: StaffOptions }) {
  const { section, data, snapshot, user, refresh, setDirty, setBusy, options } = props;
  const [draft, setDraft] = useState<DataRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [choicesOpen,setChoicesOpen] = useState(false);
  const [representative,setRepresentative] = useState<DataRow|null>(null);
  const countries = user?.staff_edit_countries ?? [];
  const rows = sectionRows(snapshot, "staff").map(person=>({...person,...(person.custom_values as Record<string,unknown>??{})}));
  const customItems=options.items.filter(item=>item.custom);
  const [managed, setManaged] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const allColumns:Field[] = [...staffFields(data, options.can_view_grade),...customItems.map(item=>({key:item.key,label:item.label}))];
  const [hidden, setHidden] = useState<string[]>(["pc_ip", "autoever_account", "z_account", "account_name"]);
  const columns = allColumns.filter((field) => !hidden.includes(field.key));
  const [page, setPage] = useState(1);
  const available = (kind:string,country:string) => options.items.find(item=>item.key===kind)?.values.filter(item=>(kind!=="work_location"||item.country_code===country)&&(item.choice_id!==null||item.default))??[];
  const firstChoice = (kind:string,country:string) => available(kind,country)[0]?.value??"";
  const fields: Field[] = [
    ...staffEditFields(countries, user?.is_staff ? "admin" : user?.role, String(draft?.job_title ?? "")),
    ...(options.can_view_grade ? [
      { key: "grade", label: "등급", type: "select" as const, nullable: true, default: "", options: [{ value: "", label: "미등록" }, ...["L1", "L2", "L3", "L4"].map((value) => ({ value, label: value }))] },
      { key: "account", label: "회원 계정 연결", type: "select" as const, nullable: true, numberValue: true, options: [{ value: "", label: "미연결" }, ...options.accounts.filter((account) => !rows.some((person) => person.account === account.id && person.id !== draft?.id)).map((account) => ({ value: String(account.id), label: `${account.name} (${account.username})` }))] },
    ] : []),
    ...customItems.map(item=>({key:item.key,label:item.label,type:"select" as const,default:""})),
  ].filter((field) => managed || ["staff_name", "job_description", "work_location", "pc_ip", "autoever_account", "z_account"].includes(field.key)).map(field=>{
    if(!["company_name","work_location","grade",...customItems.map(item=>item.key)].includes(field.key)) return field;
    const values=available(field.key,String(draft?.country_code??rows.find(person=>person.id===draft?.id)?.country_code??countries[0]??"KR")).map(item=>item.value);
    const current=String(draft?.[field.key]??"");
    if(current&&!values.includes(current)) values.push(current);
    return {...field,type:"select" as const,options:[{value:"",label:"미등록"},...values.map(value=>({value,label:value}))]};
  });
  const scoped = rows.filter((person) => (!region || person.country_code === region)
    && (!search.trim() || String(person.staff_name ?? "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    && Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    if (key.endsWith("_from") || key.endsWith("_to")) {
      const field = key.replace(/_(from|to)$/, "");
      const actual = String(person[field] ?? "");
      return Boolean(actual) && (key.endsWith("_from") ? actual >= value : actual <= value);
    }
    return String(person[key] ?? "") === value;
  }));
  const filtered = scoped.filter((person) => !status || person.work_status === status);
  const regionRows = rows.filter((person) => !region || person.country_code === region);
  const count = (list: DataRow[], value: string) => list.filter((person) => person.work_status === value).length;
  const pick = (next: { region?: string; status?: string }) => { if (next.region !== undefined) setRegion(next.region); if (next.status !== undefined) setStatus(next.status); setPage(1); };
  const pages = Math.max(1, Math.ceil(filtered.length / 30));
  const current = Math.min(page, pages);
  const kpis = [
    { value: "", label: "전체 인원", count: regionRows.length, note: `퇴사 ${count(regionRows, "retired")}명 포함` },
    { value: "scheduled", label: "근무 예정", count: count(regionRows, "scheduled"), note: "현지 평일 · 휴가 아님" },
    { value: "leave", label: "휴가", count: count(regionRows, "leave"), note: "오늘 연차·결혼휴가" },
    { value: "off", label: "휴무", count: count(regionRows, "off"), note: "현지 주말 · 투입 전" },
  ];
  const setFilter = (key: string, value: string) => { setFilters({ ...filters, [key]: value }); setPage(1); };
  function open(person?: DataRow) {
    setError("");
    const canManage = !person || person.can_manage === true;
    setManaged(canManage);
    const editFields = canManage ? staffEditFields(countries, user?.is_staff ? "admin" : user?.role, String(person?.job_title ?? "")) : fields.filter((field) => ["staff_name", "job_description", "work_location", "pc_ip", "autoever_account", "z_account"].includes(field.key));
    const keys = [...editFields.map((field) => field.key), ...(canManage && options.can_view_grade ? ["grade", "account"] : []),...(canManage?customItems.map(item=>item.key):[])];
    setDraft(person ? Object.fromEntries(["id", ...keys].map((key) => [key, person[key] ?? (key.endsWith("_date") || key === "account" ? null : "")])) : {
      ...Object.fromEntries(editFields.map((field) => [field.key, field.default ?? (field.nullable ? null : "")])),
      work_location: firstChoice("work_location",countries[0]),
      company_name: firstChoice("company_name",countries[0]),
      ...(options.can_view_grade ? { grade: "", account: null } : {}),
      ...Object.fromEntries(customItems.map(item=>[item.key,""])),
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
      const person:DataRow={...draft};
      if(managed) person.custom_values=Object.fromEntries(customItems.map(item=>[item.key,String(draft[item.key]??"")]));
      for(const item of customItems) delete person[item.key];
      await saveStaffPerson(snapshot.revision, person);
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
  async function setSiteRepresentative() {
    if(!representative||saving) return;
    setSaving(true);setBusy(true);setError("");
    try {
      await saveResponsibility(snapshot.revision,{country_code:String(representative.country_code),site_representative:representative.is_site_representative?null:representative.id??null});
      setRepresentative(null);
      try {await refresh();} catch {setRefreshError("지정은 완료됐지만 화면을 갱신하지 못했습니다. 다시 불러와 주세요.");}
    } catch(cause) {setError(cause instanceof Error?cause.message:"현장대리인을 지정하지 못했습니다.");}
    finally {setSaving(false);setBusy(false);}
  }
  return (
    <div className="report-sections staff-page staff-overview">
      <header className="section-head">
        <div><h1>{section.label}</h1><p className="section-sub">KR · EU · NA 현지 날짜 기준 오늘의 인력 현황과 일정</p></div>
        <div className="actions">{options.can_manage_choices && <button className="btn" onClick={() => setChoicesOpen(true)}>항목 추가</button>}{countries.length > 0 && <button className="btn btn-primary" onClick={() => open()}>운영 인력 추가</button>}<button className="btn" onClick={() => exportCsv(section.key, columns, filtered)}>CSV 내보내기</button></div>
      </header>
      <ErrorMessage message={refreshError} />
      <div className="staff-kpis" role="group" aria-label={`${region || "전체 권역"} 근무 상태 요약`}>
        {kpis.map((item) => <button type="button" key={item.label} aria-pressed={status === item.value} className={`staff-kpi staff-kpi-${item.value || "all"}`} onClick={() => pick({ status: item.value })}>
          <span>{item.label}</span><strong>{item.count}<small>명</small></strong><small>{item.note}</small>
        </button>)}
      </div>
      <StaffResponsibilities rows={rows} options={options} countries={countries} revision={snapshot.revision} refresh={refresh} setBusy={setBusy} region={region} onRegion={(value) => pick({ region: value })} />
      <Panel title="인력 현황" subtitle="출근 기록이 없어 근무중이 아닌 근무 예정으로 표시합니다.">
        <div className="staff-toolbar">
          <div className="staff-chips" role="group" aria-label="권역 필터"><span className="staff-chips-label">권역</span>{[["", "전체"], ...Object.keys(REGIONS).map((code) => [code, code])].map(([value, label]) => <button type="button" key={value} aria-pressed={region === value} onClick={() => pick({ region: value })}>{label}<b>{value ? rows.filter((person) => person.country_code === value).length : rows.length}</b></button>)}</div>
          <div className="staff-chips" role="group" aria-label="상태 필터"><span className="staff-chips-label">상태</span>{[{ value: "", label: "전체" }, ...WORK_STATUSES].map((item) => <button type="button" key={item.value} aria-pressed={status === item.value} className={item.value ? `staff-chip-${item.value}` : undefined} onClick={() => pick({ status: item.value })}>{item.value && <i aria-hidden="true" />}{item.label}<b>{item.value ? count(scoped, item.value) : scoped.length}</b></button>)}</div>
          <label className="staff-search">이름 검색<input type="search" value={search} placeholder="성명으로 검색" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        </div>
        <details className="staff-more-filters">
          <summary>상세 필터 · 표시 컬럼{Object.values(filters).some(Boolean) ? " (적용 중)" : ""}</summary>
          <div className="staff-directory-filters">
            {["global_region", "company_name", "job_title", ...(options.can_view_grade ? ["grade"] : []), ...customItems.map(item => item.key)].map((key) => <label key={key}>{allColumns.find((field) => field.key === key)?.label}<select value={filters[key] ?? ""} onChange={(event) => setFilter(key, event.target.value)}><option value="">전체</option>{[...new Set(rows.map((person) => String(person[key] ?? "")).filter(Boolean))].sort().map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}
            {[["deployment_date", "투입일"], ["resignation_date", "회사 퇴사일"]].map(([key, label]) => <fieldset className="staff-date-range" key={key}><legend>{label}</legend><input type="date" aria-label={`${label} 시작`} value={filters[`${key}_from`] ?? ""} onChange={(event) => setFilter(`${key}_from`, event.target.value)} /><span>~</span><input type="date" aria-label={`${label} 끝`} value={filters[`${key}_to`] ?? ""} onChange={(event) => setFilter(`${key}_to`, event.target.value)} /></fieldset>)}
            <button className="btn btn-sm" onClick={() => { setFilters({}); setRegion(""); setStatus(""); setSearch(""); setPage(1); }}>필터 초기화</button>
            <details className="staff-column-picker"><summary>표시 컬럼</summary><div>{allColumns.map((field) => <label key={field.key}><input type="checkbox" checked={!hidden.includes(field.key)} disabled={["country_code", "staff"].includes(field.key)} onChange={(event) => setHidden(event.target.checked ? hidden.filter((key) => key !== field.key) : [...hidden, field.key])} />{field.label}</label>)}</div></details>
          </div>
        </details>
        <div className="staff-role-legend" aria-label="직책별 배경색"><span className="staff-legend-team-lead">팀장</span><span className="staff-legend-group-lead">그룹장</span><span className="staff-legend-user">책임</span><span className="staff-legend-observer">옵저버</span><span className="staff-legend-representative">현장대리인은 별도 표기</span></div>
        <StaffTable rows={filtered.slice((current - 1) * 30, current * 30)} columns={columns} data={data} onEdit={rows.some((person) => person.can_edit) ? open : undefined} onRepresentative={rows.some(person => person.can_set_site_representative) ? person => { setError(""); setRepresentative(person); } : undefined} />
        <div className="staff-pagination"><span>{filtered.length}명{region || status || search ? ` · 전체 ${rows.length}명 중` : ""}</span><div className="actions"><button className="btn btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>이전</button><span>{current} / {pages}</span><button className="btn btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>다음</button></div></div>
      </Panel>
      <StaffCalendar {...props} country={region} onCountry={(value) => pick({ region: value })} />
      {choicesOpen && <StaffChoices items={options.items} columnLabels={allColumns.map(field => field.label)} revision={snapshot.revision} refresh={refresh} setBusy={setBusy} onClose={() => setChoicesOpen(false)} />}
      {representative&&<Modal title={`현장대리인 ${representative.is_site_representative?"해제":"지정"}`} onClose={()=>{if(!saving)setRepresentative(null);}}><p>{String(representative.staff_name)}님을 {String(representative.country_code)} 권역 현장대리인으로 {representative.is_site_representative?"지정 해제":"지정"}하시겠습니까?</p><p>직책은 그대로 유지하며, 지정된 사람의 직책 옆에 현장대리인을 별도로 표시합니다.</p><ErrorMessage message={error}/><div className="actions"><button className="btn" disabled={saving} onClick={()=>setRepresentative(null)}>취소</button><button className="btn btn-primary" disabled={saving} onClick={()=>void setSiteRepresentative()}>{representative.is_site_representative?"지정 해제":"현장대리인 지정"}</button></div></Modal>}
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
    </div>
  );
}
