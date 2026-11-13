import { useEffect, useState } from "react";
import Modal from "../../shared/components/Modal";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { addStaffChoice, deleteStaffChoice, type StaffChoice } from "./api";

export default function StaffChoices({ choices, revision, refresh, setBusy, onClose }: {
  choices:StaffChoice[]; revision:number; refresh:()=>Promise<void>; setBusy:(value:boolean)=>void; onClose:()=>void;
}) {
  const [kind,setKind] = useState<StaffChoice["kind"]>("work_location");
  const [country,setCountry] = useState("KR");
  const [value,setValue] = useState("");
  const [items,setItems] = useState(choices);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [removing,setRemoving] = useState<StaffChoice|null>(null);
  useEffect(()=>setItems(choices),[choices]);
  async function change(remove?:StaffChoice) {
    if(saving) return;
    setSaving(true); setBusy(true); setError("");
    try {
      const result = remove ? await deleteStaffChoice(revision,remove.id) : await addStaffChoice(revision,{kind,country_code:kind==="work_location"?country:"",value:value.trim()});
      setItems(result.choices); setValue(""); setRemoving(null);
      try { await refresh(); } catch { setError("선택지는 저장되었습니다. 최신 화면을 다시 불러와 주세요."); }
    } catch(cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); setBusy(false); }
  }
  const visible=items.filter(item=>item.kind===kind&&(kind!=="work_location"||item.country_code===country));
  return <Modal title="운영 인력 선택지 관리" onClose={()=>{if(!saving)onClose();}}>
    <div className="staff-choice-manager">
      <div className="staff-choice-filters"><label>항목<select disabled={saving} value={kind} onChange={event=>{setKind(event.target.value as StaffChoice["kind"]);setRemoving(null);}}><option value="work_location">근무지</option><option value="company_name">소속사</option></select></label>
        {kind==="work_location"&&<label>권역<select disabled={saving} value={country} onChange={event=>{setCountry(event.target.value);setRemoving(null);}}><option value="KR">한국</option><option value="NA">미국</option><option value="EU">유럽</option></select></label>}</div>
      <form onSubmit={event=>{event.preventDefault();void change();}} className="staff-choice-add"><label>새 {kind==="work_location"?"근무지":"소속사"}<input required disabled={saving} maxLength={kind==="work_location"?150:100} value={value} onChange={event=>setValue(event.target.value)} /></label><button className="btn btn-primary" disabled={saving||!value.trim()}>추가</button></form>
      <ul className="staff-choice-list">{visible.map(item=><li key={item.id}><span>{item.value}</span><button className="btn btn-sm" disabled={saving} onClick={()=>setRemoving(item)}>삭제</button></li>)}</ul>
      {!visible.length&&<p className="report-empty">등록된 선택지가 없습니다.</p>}
      {removing&&<div className="staff-choice-confirm" role="alert"><p>‘{removing.value}’ 선택지를 삭제하시겠습니까? 기존 인력에 저장된 값은 유지됩니다.</p><div className="actions"><button className="btn" disabled={saving} onClick={()=>setRemoving(null)}>취소</button><button className="btn btn-danger" disabled={saving} onClick={()=>void change(removing)}>선택지 삭제</button></div></div>}
      <ErrorMessage message={error}/><div className="actions"><button className="btn" disabled={saving} onClick={onClose}>닫기</button></div>
    </div>
  </Modal>;
}
