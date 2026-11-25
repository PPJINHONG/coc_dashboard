import { useEffect, useState } from "react";
import Modal from "../../shared/components/Modal";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { ApiError } from "../../shared/api/client";
import {
  saveStaffPerson,
  addStaffChoice,
  deleteStaffChoice,
  addStaffColumn,
  setStaffFreeText,
  deleteStaffColumn,
  reorderStaffColumns,
  type StaffItem,
  type StaffItemValue,
} from "./api";

import type { DataRow } from "../../shared/api/operations";
import StaffDateInput, { ONGOING } from "./StaffDateInput";
import { staffFields } from "./fields";

export default function StaffChoices({ people, items, columnOrder, revision, refresh, setBusy, onClose }: {
  people: DataRow[];
  items: StaffItem[];
  columnOrder: string[];
  revision: number;
  refresh: () => Promise<void>;
  setBusy: (value: boolean) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"values" | "columns">("columns");
  const [selected, setSelected] = useState(items[0]?.key ?? "");
  const [personId, setPersonId] = useState("");
  const [dateDraft, setDateDraft] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [columnName, setColumnName] = useState("");
  const [allowFreeText, setAllowFreeText] = useState(true);
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState(items);
  const [order, setOrder] = useState(columnOrder);
  useEffect(() => setOrder(columnOrder), [columnOrder]);
  const [version, setVersion] = useState(revision);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<StaffItemValue | null>(null);
  const [removingColumn, setRemovingColumn] = useState<StaffItem | null>(null);

  useEffect(() => setCatalog(items), [items]);
  useEffect(() => setVersion(revision), [revision]);
  useEffect(() => {
    if (selected && catalog.some((entry) => entry.key === selected)) return;
    setSelected(catalog[0]?.key ?? "");
  }, [catalog, selected]);

  const item = catalog.find((entry) => entry.key === selected) ?? catalog[0];
  const visible = (item?.values ?? []).filter((entry) =>
    entry.value.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const alreadyExists = Boolean(item?.values.some((entry) =>
    entry.value === value.trim()
    && entry.choice_id !== null));

  const person = people.find((row) => String(row.id) === personId);
  const savedDate = String(person?.[item?.key] ?? "");
  const selectedDate = dateDraft ?? savedDate;

  const columnBlockReason = (entry: StaffItem) => {
    if (!entry.custom) return "필수 날짜 · 삭제 불가";
    const uses = entry.values.reduce((total, current) => total + current.uses, 0);
    const choices = entry.values.filter((current) => current.choice_id !== null).length;
    if (uses) return `${uses}명의 인력이 사용 중`;
    if (choices) return `등록된 선택값 ${choices}개 삭제 필요`;
    return "";
  };

  async function reloadAfterSave(fallback: string) {
    try {
      await refresh();
    } catch {
      setError(fallback);
    }
  }

  async function saveChoice(remove?: StaffItemValue, existingValue?: string) {
    if (saving || !item) return;
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const result = remove?.choice_id != null
        ? await deleteStaffChoice(version, remove.choice_id)
        : await addStaffChoice(version, {
            kind: item.key,
            value: (existingValue ?? value).trim(),
          });
      setVersion(result.revision); setCatalog(result.items); setOrder(result.column_order); setValue(""); setRemoving(null);
      setNotice(remove ? "선택값 삭제 완료 · 기존 인력 값 유지" : "선택값 추가 완료");
      await reloadAfterSave("저장 완료 · 화면 갱신 실패 · 다시 불러오기 필요");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await refresh().catch(() => undefined);
    } finally {
      setSaving(false); setBusy(false);
    }
  }

  async function saveDate() {
    if (!person || !selectedDate || saving) return;
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveStaffPerson(version, { id: person.id, [item.key]: selectedDate === ONGOING ? null : selectedDate });
      setVersion(result.revision);
      setNotice(`${person.staff_name} · ${item.label} 저장 완료`);
      await reloadAfterSave("날짜 저장 완료 · 화면 갱신 실패");
      setDateDraft(null);
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await refresh().catch(() => undefined);
    } finally {
      setSaving(false); setBusy(false);
    }
  }

  async function createColumn() {
    if (saving || !columnName.trim()) return;
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const result = await addStaffColumn(version, columnName.trim(), allowFreeText);
      setVersion(result.revision); setCatalog(result.items); setOrder(result.column_order); setSelected(result.column.key); setMode("values");
      setColumnName(""); setAllowFreeText(true); setValue(""); setSearch("");
      setNotice(`‘${result.column.label}’ 열 추가 완료`);
      await reloadAfterSave("열 추가 완료 · 화면 갱신 실패 · 다시 불러오기 필요");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await refresh().catch(() => undefined);
    } finally {
      setSaving(false); setBusy(false);
    }
  }

  async function changeFreeText(enabled: boolean) {
    if (saving || !item) return;
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const result = await setStaffFreeText(version, item.key, enabled);
      setVersion(result.revision); setCatalog(result.items);
      await reloadAfterSave("설정 저장 완료 · 화면 갱신 실패");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await refresh().catch(() => undefined);
    } finally {
      setSaving(false); setBusy(false);
    }
  }

  async function removeColumn() {
    if (saving || !removingColumn) return;
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const deleted = removingColumn;
      const result = await deleteStaffColumn(version, deleted.key);
      setVersion(result.revision); setCatalog(result.items); setOrder(result.column_order); setRemovingColumn(null); setValue(""); setSearch("");
      setNotice(`‘${deleted.label}’ 열 삭제 완료`);
      await reloadAfterSave("열 삭제 완료 · 화면 갱신 실패 · 다시 불러오기 필요");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await refresh().catch(() => undefined);
    } finally {
      setSaving(false); setBusy(false);
    }
  }

  async function moveColumn(key: string, direction: -1 | 1) {
    if (saving) return;
    const keys = [...order];
    const from = keys.indexOf(key);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= keys.length) return;
    [keys[from], keys[to]] = [keys[to], keys[from]];
    setSaving(true); setBusy(true); setError(""); setNotice("");
    try {
      const result = await reorderStaffColumns(version, keys);
      setVersion(result.revision); setCatalog(result.items); setOrder(result.column_order); setNotice("열 순서 변경 완료");
      await reloadAfterSave("순서 저장 완료 · 화면 갱신 실패 · 다시 불러오기 필요");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) await refresh().catch(() => undefined);
    } finally {
      setSaving(false); setBusy(false);
    }
  }

  return <Modal title="항목 관리" className="staff-items-modal" onClose={() => { if (!saving) onClose(); }}>
    <div className="staff-item-manager">
      <div className="staff-item-tabs" role="tablist" aria-label="항목 관리 방식">
        <button type="button" role="tab" aria-selected={mode === "values"} disabled={saving || !catalog.length} onClick={() => { setMode("values"); setError(""); setRemovingColumn(null); }}>선택값 관리</button>
        <button type="button" role="tab" aria-selected={mode === "columns"} disabled={saving} onClick={() => { setMode("columns"); setError(""); setRemoving(null); setRemovingColumn(null); }}>열 관리·순서</button>
      </div>
      {notice && <p className="staff-item-notice" role="status">{notice}</p>}

      {mode === "columns" ? <div className="staff-column-create">
        <section className="staff-existing-panel">
          <h3>열 순서</h3>
          <ol className="staff-column-order-list">{order.map((key, index) => {
            const custom = catalog.find((entry) => entry.key === key);
            const field = custom ?? staffFields().find((entry) => entry.key === key);
            if (!field) return null;
            const blocked = custom ? columnBlockReason(custom) : "필수 · 삭제 불가";
            return <li key={key}>
              <span className="staff-column-position">{index + 1}</span>
              <div><strong>{field.label}</strong><small>{blocked || "공통 선택값"}</small></div>
              <div className="staff-column-order-actions">
                <button type="button" className="btn btn-sm" disabled={saving || index === 0} aria-label={field.label + " 위로 이동"} onClick={() => void moveColumn(key, -1)}>↑</button>
                <button type="button" className="btn btn-sm" disabled={saving || index === order.length - 1} aria-label={field.label + " 아래로 이동"} onClick={() => void moveColumn(key, 1)}>↓</button>
                {custom && <button type="button" className="btn btn-sm btn-danger" disabled={saving || Boolean(blocked)} title={blocked || "추가 열 삭제"} onClick={() => setRemovingColumn(custom)}>삭제</button>}
              </div>
            </li>;
          })}</ol>
          <p className="staff-column-delete-help">등록 값과 사용 인력이 없는 열만 삭제 가능</p>
        </section>
        <form onSubmit={(event) => { event.preventDefault(); void createColumn(); }}>
          <label>새 열 이름<input aria-label="새 열 이름" value={columnName} disabled={saving} required maxLength={80} placeholder="예: 소속사, 근무지, 등급" onChange={(event) => setColumnName(event.target.value)} /></label>
          <label className="staff-column-scope"><input type="checkbox" checked={allowFreeText} disabled={saving} onChange={(event) => setAllowFreeText(event.target.checked)} />자유 입력 허용</label>
          <button className="btn btn-primary" disabled={saving || !columnName.trim()}>열 추가 후 값 등록</button>
        </form>
      </div> : item ? <div className="staff-items-layout">
        <nav className="staff-item-fields" aria-label="선택값을 관리할 열">{catalog.map((entry) => <button type="button" key={entry.key} aria-pressed={item.key === entry.key} disabled={saving} onClick={() => { setSelected(entry.key); setDateDraft(null); setNotice(""); setValue(""); setSearch(""); setRemoving(null); setError(""); }}><strong>{entry.label}</strong><small>{entry.custom ? "공통 값" : "날짜 선택"}</small></button>)}</nav>
        <div className="staff-item-values">
          <header><h3>{item.label}</h3></header>
          {!item.custom ? <form className="staff-managed-date" onSubmit={(event) => { event.preventDefault(); void saveDate(); }}>
            <fieldset disabled={saving}>
              <label>운영 인력<select value={personId} onChange={(event) => { setPersonId(event.target.value); setDateDraft(null); setNotice(""); setError(""); }}>
                <option value="">인력 선택</option>
                {people.map((row) => <option key={row.id} value={row.id}>{String(row.staff_name)} · {String(row.country_code)}</option>)}
              </select></label>
              {person && <StaffDateInput fieldKey={item.key} label={item.label} value={selectedDate} onChange={setDateDraft} required />}
            </fieldset>
            <button className="btn btn-primary" disabled={!person || saving || !selectedDate || selectedDate === savedDate}>날짜 저장</button>
          </form> : <>
          <label className="staff-free-text-setting"><input type="checkbox" checked={item.allow_free_text} disabled={saving} onChange={(event) => void changeFreeText(event.target.checked)} />자유 입력 허용</label>
          <section className="staff-existing-panel" aria-label="기존 선택값">
            <div className="staff-existing-heading"><h4>기존 값</h4><input aria-label="기존 값 검색" type="search" placeholder="값 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <ul className="staff-item-value-list">{visible.map((entry) => <li key={entry.value}><div><strong>{entry.value}</strong><span>{entry.choice_id != null ? "등록된 선택값" : "기존 인력 값"}{entry.uses > 0 ? ` · ${entry.uses}명 사용 중` : ""}</span></div>
              {entry.choice_id != null ? <button className="btn btn-sm" type="button" disabled={saving} onClick={() => setRemoving(entry)}>삭제</button> : <button className="btn btn-sm" type="button" disabled={saving} onClick={() => void saveChoice(undefined, entry.value)}>선택값으로 등록</button>}
            </li>)}</ul>
            {!visible.length && <p className="report-empty">{search ? "검색 결과 없음" : "등록된 선택값 없음"}</p>}
          </section>
          <form className="staff-item-add" onSubmit={(event) => { event.preventDefault(); void saveChoice(); }}><label>추가할 {item.label} 값<input aria-label="추가할 선택값" value={value} disabled={saving} required maxLength={150} onChange={(event) => setValue(event.target.value)} /></label><button className="btn btn-primary" disabled={saving || !value.trim() || alreadyExists}>선택값 추가</button></form>
          {alreadyExists && <p className="staff-item-help">이미 등록된 선택값</p>}
          {removing && <div className="staff-choice-confirm" role="alert"><p>‘{removing.value}’ 선택값 삭제 여부 확인 · 기존 인력 값 유지</p><div className="actions"><button className="btn" type="button" disabled={saving} onClick={() => setRemoving(null)}>취소</button><button className="btn btn-danger" type="button" disabled={saving} onClick={() => void saveChoice(removing)}>선택값 삭제</button></div></div>}
          </>}
        </div>
      </div> : <p className="report-empty">열 관리에서 첫 추가 열 등록 필요</p>}

      {removingColumn && <div className="staff-choice-confirm" role="alert"><p>‘{removingColumn.label}’ 추가 열 삭제 여부 확인 · 인력 목록과 입력 화면에서도 제거</p><div className="actions"><button className="btn" type="button" disabled={saving} onClick={() => setRemovingColumn(null)}>취소</button><button className="btn btn-danger" type="button" disabled={saving} onClick={() => void removeColumn()}>열 삭제</button></div></div>}
      <ErrorMessage message={error} />
      <div className="actions"><button className="btn" disabled={saving} onClick={onClose}>닫기</button></div>
    </div>
  </Modal>;
}
