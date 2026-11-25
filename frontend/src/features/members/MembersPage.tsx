import { useEffect, useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import Modal from "../../shared/components/Modal";
import Panel from "../../shared/components/Panel";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { getMembers, resetMemberPassword, saveMember, type Member, type MemberList } from "./api";

const ROLES = { admin: "관리자", user: "책임" } as const;
const date = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR") : "—";
const PAGE_SIZE = 30;
interface Draft { id?: number; name: string; email: string; role: "admin" | "user"; is_active: boolean; can_edit: boolean }

export default function MembersPage({ user, refresh, setBusy, setDirty }: FeaturePageProps) {
  const [result, setResult] = useState<MemberList>({ accounts: [], assignable_roles: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const allowed = Boolean(user?.is_staff);

  async function load() {
    setLoading(true);
    try { setResult(await getMembers()); setError(""); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (allowed) void load(); else setLoading(false); }, [allowed, user?.id]);
  if (!allowed) return <ErrorMessage message="회원정보는 관리자만 접근 가능" />;

  const filtered = result.accounts.filter((member) =>
    (!role || member.role === role)
    && (!status || String(member.is_active) === status)
    && `${member.name} ${member.email}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function open(member?: Member) {
    setFormError(""); setConfirmReset(false);
    setDraft(member ? { id: member.id, name: member.name, email: member.email, role: member.role, is_active: member.is_active, can_edit: member.can_edit }
      : { name: "", email: "", role: "user", is_active: true, can_edit: true });
  }
  function close() { if (!saving) { setDraft(null); setConfirmReset(false); setDirty(false); } }
  function change(values: Partial<Draft>) { if (draft) { setDraft({ ...draft, ...values }); setDirty(true); } }

  async function save() {
    if (!draft || !draft.can_edit || saving) return;
    setSaving(true); setBusy(true); setFormError("");
    try {
      await saveMember(draft.id, { name: draft.name, email: draft.email, role: draft.role, is_active: draft.is_active });
      setDraft(null); setDirty(false);
      const [value] = await Promise.all([getMembers(), refresh()]);
      setResult(value); setError("");
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally { setSaving(false); setBusy(false); }
  }

  async function resetPassword() {
    if (!draft?.id || !draft.can_edit || saving) return;
    setSaving(true); setBusy(true); setFormError("");
    try {
      await resetMemberPassword(draft.id);
      setConfirmReset(false);
      const value = await getMembers();
      setResult(value);
      setFormError("비밀번호 초기화 완료 · 초기 비밀번호 1111 · 다음 로그인 시 변경 필요");
    } catch (cause) { setFormError(errorMessage(cause)); }
    finally { setSaving(false); setBusy(false); }
  }

  return <div className="members-page report-sections">
    <header className="section-head"><div><span className="eyebrow">MEMBERS</span><h1>회원정보</h1><p className="section-sub">이름 로그인·이메일·역할·계정 상태 관리</p></div>
      <button className="btn btn-primary" disabled={loading || saving} onClick={() => open()}>회원 추가</button></header>
    <ErrorMessage message={error} />
    <Panel title="필터"><div className="members-filters">
      <label>이름 / 이메일<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="회원 검색" /></label>
      <label>역할<select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">전체 역할</option><option value="admin">관리자</option><option value="user">책임</option></select></label>
      <label>계정 상태<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">전체 상태</option><option value="true">활성</option><option value="false">비활성</option></select></label>
      <button className="btn" onClick={() => { setSearch(""); setRole(""); setStatus(""); setPage(1); }}>초기화</button>
    </div></Panel>
    <Panel title={`회원 목록 · ${filtered.length}명`}>
      {loading ? <p className="members-empty" role="status">회원 불러오는 중…</p> : <div className="report-table-scroll" role="region" aria-label="회원 목록" tabIndex={0}><table className="report-table members-table">
        <thead><tr>{["이름 (로그인)", "이메일", "역할", "계정 상태", "비밀번호", "로그인 상태", "최근 로그인", "관리"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible.map((member) => <tr key={member.id}>
          <td><button className="members-account-link" onClick={() => open(member)}>{member.name}</button></td>
          <td>{member.email}</td><td>{ROLES[member.role]}</td>
          <td><span className="report-badge">{member.is_active ? "활성" : "비활성"}</span></td>
          <td>{member.must_change_password ? "변경 필요" : "설정 완료"}</td>
          <td>{member.is_online ? `로그인 중 (${member.active_sessions})` : "로그아웃"}</td>
          <td>{date(member.last_login)}</td><td><button className="btn btn-sm" onClick={() => open(member)}>{member.can_edit ? "수정" : "조회"}</button></td>
        </tr>)}{!visible.length && <tr><td colSpan={8} className="members-empty">조건에 맞는 회원 없음</td></tr>}</tbody>
      </table></div>}
      <div className="members-pagination"><span>{filtered.length}명 중 {visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}명</span><div className="actions"><button className="btn btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage} / {pages}</span><button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</button></div></div>
    </Panel>

    {draft && <Modal title={draft.id ? "회원 정보" : "회원 추가"} onClose={close}>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="members-form">
        <fieldset disabled={saving || !draft.can_edit} className="members-fields">
          <label>이름 (로그인 이름)<input value={draft.name} required maxLength={150} placeholder="고유한 이름" onChange={(event) => change({ name: event.target.value })} /></label>
          <label>이메일<input type="email" value={draft.email} required maxLength={254} placeholder="name@company.com" onChange={(event) => change({ email: event.target.value })} /></label>
          <label>역할<select value={draft.role} onChange={(event) => change({ role: event.target.value as Draft["role"] })}><option value="user">책임</option><option value="admin">관리자</option></select></label>
          <label>계정 상태<select value={String(draft.is_active)} onChange={(event) => change({ is_active: event.target.value === "true" })}><option value="true">활성</option><option value="false">비활성</option></select></label>
          {!draft.id && <p className="field-hint">초기 비밀번호 1111 · 첫 로그인 시 새 비밀번호 설정</p>}
        </fieldset>
        {draft.id && draft.can_edit && <section className="member-password-reset">
          <div><strong>비밀번호 초기화</strong><p>초기 비밀번호 1111로 변경 후 기존 로그인 세션 종료</p></div>
          {!confirmReset ? <button type="button" className="btn btn-danger" onClick={() => setConfirmReset(true)}>비밀번호 초기화</button>
            : <div className="actions"><button type="button" className="btn" onClick={() => setConfirmReset(false)}>취소</button><button type="button" className="btn btn-danger" onClick={() => void resetPassword()}>1111로 초기화</button></div>}
        </section>}
        <ErrorMessage message={formError} />
        <div className="actions"><button type="button" className="btn" onClick={close} disabled={saving}>{draft.can_edit ? "취소" : "닫기"}</button>{draft.can_edit && <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : draft.id ? "저장" : "등록"}</button>}</div>
      </form>
    </Modal>}
  </div>;
}
