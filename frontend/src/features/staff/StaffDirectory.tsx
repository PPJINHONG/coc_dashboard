import { useState } from "react";
import { sectionRows, type DataRow } from "../../shared/api/operations";
import { ApiError } from "../../shared/api/client";
import ErrorMessage from "../../shared/components/ErrorMessage";
import FieldInput from "../../shared/components/FieldInput";
import Modal from "../../shared/components/Modal";
import { saveStaffPerson, type StaffOptions } from "./api";
import { staffFields } from "./fields";
import { exportCsv } from "../../shared/fields";
import StaffTable, { sortStaff } from "./StaffTable";
import Icon from "../../shared/components/Icon";
import Panel from "../../shared/components/Panel";
import type { Field } from "../../shared/fields";
import type { StaffPageProps } from "./StaffPage";
import StaffResponsibilities, { REGIONS } from "./StaffResponsibilities";
import StaffChoices from "./StaffChoices";
import StaffDateInput, { hasOngoing, ONGOING } from "./StaffDateInput";

export default function StaffDirectory(props: StaffPageProps & { options: StaffOptions }) {
  const { section, data, snapshot, user, refresh, setDirty, setBusy, options } = props;
  const [draft, setDraft] = useState<DataRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [choicesOpen,setChoicesOpen] = useState(false);
  const countries = user?.staff_edit_countries ?? [];
  const dates = options.items.filter((item) => !item.custom);
  const rows = sectionRows(snapshot, "staff").map((person) => ({
    ...person, ...(person.custom_values as Record<string, unknown>),
    ...Object.fromEntries(dates.filter((field) => hasOngoing(field.key)).map(({key}) => [key, person[key] ?? ONGOING])),
  }));
  const customItems=options.items.filter(item=>item.custom);
  const [managed, setManaged] = useState(true);
  const [editing, setEditing] = useState(false);
  const widthKey = "staff.columnWidths." + user?.id;
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(widthKey) || "{}") ?? {}; }
    catch { return {}; }
  });
  const [draftWidths, setDraftWidths] = useState(widths);
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const catalogFields: Field[] = [...staffFields(),...options.items.map(item=>({key:item.key,label:item.label}))];
  const order = options.column_order ?? catalogFields.map((field) => field.key);
  const allColumns = order.flatMap((key) => catalogFields.filter((field) => field.key === key));
  const [hidden, setHidden] = useState<string[]>([]);
  const columns = allColumns.filter((field) => !hidden.includes(field.key));
  const [page, setPage] = useState(1);
  const inputFields: Field[] = [
    ...staffFields(countries),
    ...dates.map(({ key, label }) => ({ key, label, default: hasOngoing(key) ? ONGOING : "" })),
    ...customItems.map((item): Field => {
      const options = item.values
        .filter((entry) => entry.choice_id !== null)
        .map(({ value }) => ({ value, label: value }));
      if (item.allow_free_text) return { key: item.key, label: item.label, options };
      const current = String(draft?.[item.key] ?? "");
      if (current && !options.some((option) => option.value === current)) options.push({ value: current, label: current });
      return { key: item.key, label: item.label, type: "select", options: [{ value: "", label: "미등록" }, ...options] };
    }),
  ];
  const fields = order.flatMap((key) => inputFields.filter((field) =>
    field.key === key && (managed || (key !== "country_code" && !dates.some((item) => item.key === key)))));
  const filtered = sortStaff(rows.filter((person) => (!region || person.country_code === region)
    && String(person.staff_name ?? "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const groupCounts = filtered.reduce<Record<string, number>>((result, person) => ({ ...result, [String(person.country_code)]: (result[String(person.country_code)] ?? 0) + 1 }), {});
  const pages = Math.max(1, Math.ceil(filtered.length / 30));
  const current = Math.min(page, pages);
  function open(person?: DataRow) {
    setError("");
    const canManage = !person || person.can_manage === true;
    setManaged(canManage);
    const values = Object.fromEntries(inputFields
      .filter((field) => canManage || (field.key !== "country_code" && !dates.some((item) => item.key === field.key)))
      .map((field) => [field.key, person?.[field.key] ?? field.default ?? ""]));
    setDraft(person ? { id: person.id, ...values } : values);
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
      person.custom_values=Object.fromEntries(customItems.map(item=>[item.key,String(draft[item.key]??"")]));
      for(const item of customItems) delete person[item.key];
      for (const {key} of dates) {
        if (key in person) person[key] = person[key] === ONGOING || person[key] === "" ? null : person[key];
      }
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
  return (
    <div className="report-sections staff-page staff-overview">
      <header className="section-head">
        <div><h1>{section.label}</h1><p className="section-sub">KR · EU · NA 현지 날짜 기준 오늘의 인력 현황과 일정</p></div>
        <div className="actions">{options.can_manage_choices && <button className="btn" onClick={() => setChoicesOpen(true)}>항목 관리</button>}{countries.length > 0 && <button className="btn btn-primary" onClick={() => open()}>운영 인력 추가</button>}<button className="btn" onClick={() => exportCsv(section.key, columns, filtered)}>CSV 내보내기</button></div>
      </header>
      <ErrorMessage message={refreshError} />
      <StaffResponsibilities rows={rows} options={options} countries={countries} revision={snapshot.revision} refresh={refresh} setBusy={setBusy} region={region} onRegion={(value) => { setRegion(value); setPage(1); }} />
      <Panel title="인력 현황" action={
        <div className="staff-toolbar" role="group" aria-label="인력 현황 도구">
          <label className="staff-search">
            <Icon name="search" size={15} />
            <input type="search" aria-label="이름 검색" value={search} placeholder="이름 검색" onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <details className="staff-column-picker" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }} onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}>
            <summary className="btn"><Icon name="panel" size={15} />표시 컬럼<Icon name="chevron" size={12} /></summary>
            <div>{allColumns.map((field) => <label key={field.key}>
              <input type="checkbox" checked={!hidden.includes(field.key)} disabled={["country_code", "staff_name"].includes(field.key)} onChange={(event) => setHidden(event.target.checked ? hidden.filter((key) => key !== field.key) : [...hidden, field.key])} />
              {field.label}
            </label>)}</div>
          </details>
          {(countries.length > 0 || rows.some((person) => person.can_edit)) && <div className="actions">
            {editing ? <>
              <button className="btn" onClick={() => setEditing(false)}>편집 종료</button>
              <button className="btn btn-primary" onClick={() => {
                try { localStorage.setItem(widthKey, JSON.stringify(draftWidths)); }
                catch { setRefreshError("열 너비를 브라우저에 저장할 수 없습니다."); return; }
                setWidths(draftWidths); setEditing(false);
              }}>열 너비 저장</button>
            </> : <button className="btn btn-primary" onClick={() => { setDraftWidths(widths); setEditing(true); }}>편집</button>}
          </div>}
        </div>
      }>
        <div className="staff-role-legend" aria-label="표 구분 범례">
          <span className="staff-legend-group">리전</span>{Object.entries(REGIONS).map(([code, label]) => <span key={code} className={`staff-legend-country staff-country-${code.toLowerCase()}`}><i aria-hidden="true" />{code} {label}</span>)}
        </div>
        <StaffTable rows={filtered.slice((current - 1) * 30, current * 30)} counts={groupCounts} columns={columns} data={data} widths={editing ? draftWidths : widths} onWidth={editing ? (key, width) => setDraftWidths((previous) => ({ ...previous, [key]: width })) : undefined} onEdit={editing ? open : undefined} />
        <div className="staff-pagination"><span>{filtered.length}명{region || search ? ` · 전체 ${rows.length}명 중` : ""}</span><div className="actions"><button className="btn btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>이전</button><span>{current} / {pages}</span><button className="btn btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>다음</button></div></div>
      </Panel>
      {choicesOpen && <StaffChoices people={rows} columnOrder={order} items={options.items} revision={snapshot.revision} refresh={refresh} setBusy={setBusy} onClose={() => setChoicesOpen(false)} />}
      {draft && <Modal title={draft.id ? "운영 인력 정보 수정" : "운영 인력 추가"} onClose={close}>
        <form className="staff-person-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={saving} className="staff-person-fields">
            {fields.map((field) => dates.some((item) => item.key === field.key)
              ? <StaffDateInput key={field.key} fieldKey={field.key} label={field.label} value={String(draft[field.key] ?? "")}
                  required={!draft.id || hasOngoing(field.key) || Boolean(rows.find((person) => person.id === draft.id)?.[field.key])}
                  onChange={(value) => { setDraft({ ...draft, [field.key]: value }); setDirty(true); }} />
              : <label key={field.key}>
              <span>{field.label}{["staff_name", "country_code"].includes(field.key) && " *"}</span>
              {!field.type && field.options ? <>
                <input type="text" aria-label={field.label} list={`staff-values-${field.key}`} maxLength={150}
                  value={String(draft[field.key] ?? "")} placeholder={field.options.length ? "선택 또는 직접 입력" : "직접 입력"}
                  onChange={(event) => { setDraft({ ...draft, [field.key]: event.target.value }); setDirty(true); }} />
                <datalist id={`staff-values-${field.key}`}>{field.options.map(({ value }) => <option key={value} value={value} />)}</datalist>
              </> : <FieldInput field={field} value={draft[field.key]} label={field.label} onChange={(value) => {
                setDraft({ ...draft, [field.key]: value });
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
