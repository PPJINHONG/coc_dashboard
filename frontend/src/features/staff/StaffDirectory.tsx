import { useState } from "react";
import { sectionRows, type DataRow } from "../../shared/api/operations";
import { ApiError } from "../../shared/api/client";
import ErrorMessage from "../../shared/components/ErrorMessage";
import FieldInput from "../../shared/components/FieldInput";
import Modal from "../../shared/components/Modal";
import { saveStaffPerson, saveResponsibility, type StaffOptions } from "./api";
import { staffEditFields, staffFields, WORK_STATUSES } from "./fields";
import { exportCsv } from "../../shared/fields";
import StaffTable, { sortStaff } from "./StaffTable";
import Panel from "../../shared/components/Panel";
import Icon from "../../shared/components/Icon";
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
  // 현장대리인 지정은 관리자만 정보 수정 화면에서 합니다(서버도 관리자만 허용).
  const [siteRep, setSiteRep] = useState(false);
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
  const filtered = sortStaff(scoped.filter((person) => !status || person.work_status === status));
  const groupCounts = filtered.reduce<Record<string, number>>((result, person) => ({ ...result, [String(person.country_code)]: (result[String(person.country_code)] ?? 0) + 1 }), {});
  const regionRows = rows.filter((person) => !region || person.country_code === region);
  const count = (list: DataRow[], value: string) => list.filter((person) => person.work_status === value).length;
  const pick = (next: { region?: string; status?: string }) => { if (next.region !== undefined) setRegion(next.region); if (next.status !== undefined) setStatus(next.status); setPage(1); };
  const pages = Math.max(1, Math.ceil(filtered.length / 30));
  const current = Math.min(page, pages);
  const kpis = [
    { value: "", label: "전체 인원", count: regionRows.length, note: `퇴사 ${count(regionRows, "retired")}명 포함` },
    { value: "on_duty", label: "출근", count: count(regionRows, "on_duty"), note: "권역 근무 시간 안" },
    { value: "off_duty", label: "퇴근", count: count(regionRows, "off_duty"), note: "근무 시간 밖 · 주말" },
    { value: "leave", label: "휴가", count: count(regionRows, "leave"), note: "오늘 연차·결혼휴가" },
    { value: "planned", label: "투입 예정", count: count(regionRows, "planned"), note: "업무 투입일 전" },
  ];
  const setFilter = (key: string, value: string) => { setFilters({ ...filters, [key]: value }); setPage(1); };
  function open(person?: DataRow) {
    setError("");
    setSiteRep(person?.is_site_representative === true);
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
      const result = await saveStaffPerson(snapshot.revision, person) as { revision: number; person: DataRow };
      const original = rows.find((row) => row.id === draft.id);
      if (user?.is_staff && draft.id && siteRep !== (original?.is_site_representative === true)) {
        const country = String(result.person?.country_code ?? draft.country_code ?? original?.country_code);
        await saveResponsibility(result.revision, { country_code: country, site_representative: siteRep ? Number(draft.id) : null });
      }
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
      <Panel title="인력 현황" subtitle="출근·퇴근은 권역별 근무 시간(한국 시간) 기준입니다.">
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
        <div className="staff-role-legend" aria-label="표 구분 범례">
          <span className="staff-legend-group">권역</span>{Object.entries(REGIONS).map(([code, label]) => <span key={code} className={`staff-legend-country staff-country-${code.toLowerCase()}`}><i aria-hidden="true" />{code} {label}</span>)}
          <span className="staff-legend-group">역할</span><span className="staff-role-pill staff-role-pill-team-lead">팀장</span><span className="staff-role-pill staff-role-pill-group-lead">그룹장</span><span className="staff-job-title">책임</span><span className="staff-site-rep"><Icon name="flag" size={11} />현장대리인</span>
        </div>
        <StaffTable rows={filtered.slice((current - 1) * 30, current * 30)} counts={groupCounts} columns={columns} data={data} onEdit={rows.some((person) => person.can_edit) ? open : undefined} />
        <div className="staff-pagination"><span>{filtered.length}명{region || status || search ? ` · 전체 ${rows.length}명 중` : ""}</span><div className="actions"><button className="btn btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>이전</button><span>{current} / {pages}</span><button className="btn btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>다음</button></div></div>
      </Panel>
      {choicesOpen && <StaffChoices items={options.items} columnLabels={allColumns.map(field => field.label)} revision={snapshot.revision} refresh={refresh} setBusy={setBusy} onClose={() => setChoicesOpen(false)} />}
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
            {user?.is_staff && draft.id != null && <label className="staff-field-wide staff-check-field"><input type="checkbox" checked={siteRep} onChange={(event) => { setSiteRep(event.target.checked); setDirty(true); }} /><span>{String(draft.country_code ?? "")} 권역 현장대리인으로 지정<small>권역마다 한 명이며, 지정하면 기존 현장대리인은 해제됩니다.</small></span></label>}
          </fieldset>
          <ErrorMessage message={error} />
          <div className="actions"><button type="button" className="btn" disabled={saving} onClick={close}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : draft.id ? "저장" : "등록"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
