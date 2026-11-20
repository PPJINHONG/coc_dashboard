import { useEffect, useState } from "react";
import Modal from "../../shared/components/Modal";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { ApiError } from "../../shared/api/client";
import { addStaffChoice, deleteStaffChoice, addStaffColumn, type StaffItem, type StaffItemValue } from "./api";

const COUNTRIES = { KR:"한국", NA:"미국", EU:"유럽" };

export default function StaffChoices({ items, columnLabels, revision, refresh, setBusy, onClose }: {
  items:StaffItem[]; columnLabels:string[]; revision:number; refresh:()=>Promise<void>; setBusy:(value:boolean)=>void; onClose:()=>void;
}) {
  const [mode,setMode] = useState<"values"|"columns">("values");
  const [selected,setSelected] = useState(items[0]?.key??"");
  const [country,setCountry] = useState("KR");
  const [value,setValue] = useState("");
  const [columnName,setColumnName] = useState("");
  const [search,setSearch] = useState("");
  const [catalog,setCatalog] = useState(items);
  const [version,setVersion] = useState(revision);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [removing,setRemoving] = useState<StaffItemValue|null>(null);
  useEffect(()=>setCatalog(items),[items]);
  useEffect(()=>setVersion(revision),[revision]);
  const item=catalog.find(entry=>entry.key===selected)??catalog[0];
  const visible=(item?.values??[]).filter(entry=>(!item?.scoped||entry.country_code===country)&&entry.value.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const alreadyExists=Boolean(item?.values.some(entry=>entry.value===value.trim()&&(!item.scoped||entry.country_code===country)&&(entry.choice_id!==null||entry.default)));

  async function save(remove?:StaffItemValue, existingValue?:string) {
    if(saving||!item) return;
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const result=remove?.choice_id!=null ? await deleteStaffChoice(version,remove.choice_id) :
        await addStaffChoice(version,{kind:item.key,country_code:item.scoped?country:"",value:(existingValue??value).trim()});
      setVersion(result.revision); setCatalog(result.items); setValue(""); setRemoving(null);
      setNotice(remove?"항목 값을 삭제했습니다. 기존 인력에 저장된 값은 유지됩니다.":"항목 값을 추가했습니다.");
      try {await refresh();} catch {setError("저장은 완료됐지만 화면을 갱신하지 못했습니다. 다시 불러와 주세요.");}
    } catch(cause) {
      setError(errorMessage(cause));
      if(cause instanceof ApiError&&cause.status===409) await refresh().catch(()=>{});
    } finally {setSaving(false);setBusy(false);}
  }
  async function createColumn() {
    if(saving||!columnName.trim()) return;
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const result=await addStaffColumn(version,columnName.trim());
      setVersion(result.revision);setCatalog(result.items);setSelected(result.column.key);setMode("values");setColumnName("");setValue("");setSearch("");
      setNotice(`‘${result.column.label}’ 열을 추가했습니다. 아래에서 선택할 값을 등록하세요.`);
      try {await refresh();} catch {setError("열은 추가됐지만 화면을 갱신하지 못했습니다. 다시 불러와 주세요.");}
    } catch(cause) {setError(errorMessage(cause));if(cause instanceof ApiError&&cause.status===409) await refresh().catch(()=>{});}
    finally {setSaving(false);setBusy(false);}
  }
  return <Modal title="항목 추가" className="staff-items-modal" onClose={()=>{if(!saving)onClose();}}>
    <div className="staff-item-manager">
      <div className="staff-item-tabs" role="tablist" aria-label="항목 관리 방식">
        <button type="button" role="tab" aria-selected={mode==="values"} disabled={saving} onClick={()=>{setMode("values");setError("");}}>항목 값 추가</button>
        <button type="button" role="tab" aria-selected={mode==="columns"} disabled={saving} onClick={()=>{setMode("columns");setError("");setRemoving(null);}}>열 추가</button>
      </div>
      {notice&&<p className="staff-item-notice" role="status">{notice}</p>}
      {mode==="columns"?<div className="staff-column-create">
        <section className="staff-existing-panel"><h3>현재 등록된 열</h3><div className="staff-existing-chips">{[...new Set([...columnLabels,...catalog.filter(entry=>entry.custom).map(entry=>entry.label)])].map(label=><span key={label}>{label}</span>)}</div></section>
        <form onSubmit={event=>{event.preventDefault();void createColumn();}}><label>새 열 이름<input aria-label="새 열 이름" value={columnName} disabled={saving} required maxLength={80} placeholder="예: 담당 시스템" onChange={event=>setColumnName(event.target.value)}/></label>
          <p>추가한 열은 인력 목록과 수정 화면에 표시되며, 항목 값 추가 목록에도 자동으로 나타납니다.</p>
          <button className="btn btn-primary" disabled={saving||!columnName.trim()}>열 추가 후 값 등록</button>
        </form>
      </div>:<div className="staff-items-layout">
        <nav className="staff-item-fields" aria-label="값을 추가할 항목">{catalog.map(entry=><button type="button" key={entry.key} aria-pressed={item?.key===entry.key} disabled={saving} onClick={()=>{setSelected(entry.key);setValue("");setSearch("");setRemoving(null);setError("");}}><strong>{entry.label}</strong><small>{entry.custom?"추가 열":"기본 항목"}</small></button>)}</nav>
        <div className="staff-item-values">
          <header><h3>{item?.label??"항목"}</h3>{item?.scoped&&<label>권역<select aria-label="항목 권역" disabled={saving} value={country} onChange={event=>{setCountry(event.target.value);setRemoving(null);setSearch("");}}>{Object.entries(COUNTRIES).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>}</header>
          <section className="staff-existing-panel" aria-label="기존 항목 값"><div className="staff-existing-heading"><h4>기존 값 확인</h4><input aria-label="기존 값 검색" type="search" placeholder="기존 값 검색" value={search} onChange={event=>setSearch(event.target.value)}/></div>
            <ul className="staff-item-value-list">{visible.map(entry=><li key={`${entry.country_code}:${entry.value}`}><div><strong>{entry.value}</strong><span>{entry.default?"기본값":entry.choice_id!=null?"등록된 항목":"기존 인력에 저장된 값"}{entry.uses>0?` · ${entry.uses}명 사용 중`:""}</span></div>
              {entry.choice_id!=null?<button className="btn btn-sm" type="button" disabled={saving} onClick={()=>setRemoving(entry)}>삭제</button>:!entry.default&&<button className="btn btn-sm" type="button" disabled={saving} onClick={()=>void save(undefined,entry.value)}>항목으로 등록</button>}
            </li>)}</ul>
            {!visible.length&&<p className="report-empty">{search?"검색한 값이 없습니다.":"아직 등록된 값이 없습니다. 아래에서 첫 값을 추가하세요."}</p>}
          </section>
          <form className="staff-item-add" onSubmit={event=>{event.preventDefault();void save();}}><label>추가할 {item?.label} 값<input aria-label="추가할 항목 값" value={value} disabled={saving} required maxLength={item?.key==="grade"?40:item?.key==="company_name"?100:150} onChange={event=>setValue(event.target.value)}/></label><button className="btn btn-primary" disabled={saving||!value.trim()||alreadyExists}>항목 추가</button></form>
          {alreadyExists&&<p className="staff-item-help">이미 등록된 값입니다. 위 목록에서 확인하세요.</p>}
          {removing&&<div className="staff-choice-confirm" role="alert"><p>‘{removing.value}’ 항목을 삭제하시겠습니까? 기존 인력 값은 유지됩니다.</p><div className="actions"><button className="btn" type="button" disabled={saving} onClick={()=>setRemoving(null)}>취소</button><button className="btn btn-danger" type="button" disabled={saving} onClick={()=>void save(removing)}>항목 삭제</button></div></div>}
        </div>
      </div>}
      <ErrorMessage message={error}/><div className="actions"><button className="btn" disabled={saving} onClick={onClose}>닫기</button></div>
    </div>
  </Modal>;
}
