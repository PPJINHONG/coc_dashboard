import { useEffect, useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import Modal from "../../shared/components/Modal";
import Panel from "../../shared/components/Panel";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { getMembers, saveMember, type Member, type MemberList } from "./api";

const ROLES: Record<string, string> = { admin: "관리자", team_lead: "팀장", group_lead: "그룹장", user: "책임 (사용자)", observer: "옵저버" };
const COUNTRIES: Record<string, string> = { KR: "한국", NA: "미국", EU: "유럽" };
const date = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR") : "—";
const PAGE_SIZE = 30;
interface Draft { id?: number; name: string; username: string; role: string; managed_countries: string[]; is_active: boolean; password: string; confirm: string; can_edit: boolean }

export default function MembersPage({ user, refresh, setBusy, setDirty }: FeaturePageProps) {
  const [result, setResult] = useState<MemberList>({ accounts: [], assignable_roles: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<"profile" | "permissions">("profile");
  const [saving, setSaving] = useState(false);
  const allowed = Boolean(user?.is_staff || user?.role === "team_lead");
  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getMembers().then((value) => { if (active) { setResult(value); setError(""); } })
      .catch((cause) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, user?.id]);
  if (!allowed) return <ErrorMessage message="회원관리는 관리자와 팀장만 사용할 수 있습니다." />;
  const filtered = result.accounts.filter((member) => (!role || member.role === role)
    && (!status || String(member.is_active) === status)
    && (!country || ["admin", "team_lead"].includes(member.role) || member.managed_countries.includes(country))
    && `${member.name} ${member.username}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function open(member?: Member) {
    setFormError(""); setTab("profile");
    setDraft(member ? { ...member, password: "", confirm: "" } : {
      name: "", username: "", role: "user", managed_countries: [], is_active: true, password: "", confirm: "", can_edit: true,
    });
  }
  function close() { if (!saving) { setDraft(null); setDirty(false); } }
  function change(values: Partial<Draft>) { if (draft) { setDraft({ ...draft, ...values }); setDirty(true); } }
  async function save() {
    if (!draft || !draft.can_edit || saving) return;
    if (draft.password !== draft.confirm) { setFormError("비밀번호 확인이 일치하지 않습니다."); setTab("profile"); return; }
    if (draft.role === "group_lead" && !draft.managed_countries.length) { setFormError("관리 권역을 하나 이상 선택해 주세요."); setTab("permissions"); return; }
    setSaving(true); setBusy(true); setFormError("");
    try {
      await saveMember(draft.id, { name: draft.name, username: draft.username, role: draft.role,
        managed_countries: draft.role === "group_lead" ? draft.managed_countries : [], is_active: draft.is_active,
        ...(!draft.id || draft.password ? { password: draft.password } : {}),
      });
    } catch (cause) { setFormError(errorMessage(cause)); setSaving(false); setBusy(false); return; }
    setDraft(null); setDirty(false);
    try { const [value] = await Promise.all([getMembers(), refresh()]); setResult(value); setError(""); }
    catch { setError("저장은 완료했지만 목록 갱신에 실패했습니다. 새로고침해 주세요."); }
    finally { setSaving(false); setBusy(false); }
  }
  const selected = draft?.id ? result.accounts.find((member) => member.id === draft.id) : undefined;
  return <div className="members-page report-sections">
    <header className="section-head"><div><span className="eyebrow">MEMBERS</span><h1>회원정보</h1>
      <p className="section-sub">회원 정보와 역할, 관리 권역 및 계정 상태</p></div>
      <button className="btn btn-primary" disabled={loading || saving || !result.assignable_roles.length} onClick={() => open()}>회원 추가</button></header>
    <ErrorMessage message={error} />
    <Panel title="필터"><div className="members-filters">
      <label>이름 / 이메일 아이디<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="회원 검색" /></label>
      <label>역할<select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">전체 역할</option>{Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>관리 권역<select value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }}><option value="">전체 권역</option>{Object.entries(COUNTRIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>계정 상태<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">전체 상태</option><option value="true">활성</option><option value="false">비활성</option></select></label>
      <button className="btn" onClick={() => { setSearch(""); setRole(""); setCountry(""); setStatus(""); setPage(1); }}>초기화</button>
    </div></Panel>
    <Panel title={`회원 목록 · ${filtered.length}명`}>
      {loading ? <p className="members-empty" role="status">회원을 불러오고 있습니다…</p> : <div className="report-table-scroll" role="region" aria-label="회원 목록" tabIndex={0}><table className="report-table members-table">
        <thead><tr>{["이메일 아이디", "이름", "역할", "관리 권역", "계정 상태", "로그인 상태", "최근 로그인", "관리"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{visible.map((member) => <tr key={member.id}>
          <td><button className="members-account-link" onClick={() => open(member)}>{member.username}</button></td><td>{member.name}</td>
          <td>{ROLES[member.role] ?? member.role}</td><td>{["admin", "team_lead"].includes(member.role) ? "ALL" : member.managed_countries.map((value) => COUNTRIES[value] ?? value).join(" · ") || "—"}</td>
          <td><span className="report-badge">{member.is_active ? "활성" : "비활성"}</span></td><td>{member.is_online ? `로그인 중 (${member.active_sessions})` : "로그아웃"}</td>
          <td>{date(member.last_login)}</td><td><button className="btn btn-sm" onClick={() => open(member)} aria-label={`${member.name} 회원 ${member.can_edit ? "수정" : "조회"}`}>{member.can_edit ? "수정" : "조회"}</button></td>
        </tr>)}{!visible.length && <tr><td colSpan={8} className="members-empty">{error ? "회원 목록을 불러오지 못했습니다." : "조건에 맞는 회원이 없습니다."}</td></tr>}</tbody>
      </table></div>}
      <div className="members-pagination"><span>{filtered.length}명 중 {visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}명</span><div className="actions">
        <button className="btn btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage} / {pages}</span><button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</button></div></div>
    </Panel>
    {draft && <Modal title={draft.id ? "회원 정보" : "회원 추가"} onClose={close}>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="members-form">
        <div className="members-tabs" role="tablist" aria-label="회원 설정"><button type="button" role="tab" id="member-profile-tab" aria-selected={tab === "profile"} aria-controls="member-profile-panel" onClick={() => setTab("profile")}>회원 정보</button><button type="button" role="tab" id="member-permissions-tab" aria-selected={tab === "permissions"} aria-controls="member-permissions-panel" onClick={() => setTab("permissions")}>역할 및 권한</button></div>
        <fieldset disabled={saving || !draft.can_edit} className="members-fields" id={tab === "profile" ? "member-profile-panel" : "member-permissions-panel"} role="tabpanel" aria-labelledby={tab === "profile" ? "member-profile-tab" : "member-permissions-tab"}>
          {tab === "profile" ? <>
            <label>이메일 아이디<input value={draft.username} required aria-label="이메일 아이디" maxLength={150} onChange={(event) => change({ username: event.target.value })} /></label>
            <label>이름<input value={draft.name} required aria-label="이름" maxLength={150} onChange={(event) => change({ name: event.target.value })} /></label>
            {draft.can_edit && <><label>{draft.id ? "새 비밀번호 (변경할 때만 입력)" : "비밀번호"}<input type="password" autoComplete="new-password" required={!draft.id} minLength={8} maxLength={128} value={draft.password} onChange={(event) => change({ password: event.target.value })} /></label><label>비밀번호 확인<input type="password" autoComplete="new-password" required={Boolean(draft.password)} value={draft.confirm} onChange={(event) => change({ confirm: event.target.value })} /></label></>}
            {selected && <dl className="members-metadata"><div><dt>가입일</dt><dd>{date(selected.date_joined)}</dd></div><div><dt>최근 활동</dt><dd>{date(selected.last_activity)}</dd></div></dl>}
          </> : <>
            <label>역할<select aria-label="역할" value={draft.role} onChange={(event) => change({ role: event.target.value, managed_countries: [] })}>
              {!draft.can_edit && <option value={draft.role}>{ROLES[draft.role]}</option>}
              {draft.can_edit && result.assignable_roles.map((item) => <option key={item.value} value={item.value}>{ROLES[item.value] ?? item.label}</option>)}
            </select></label>
            {["admin", "team_lead"].includes(draft.role) && <label>관리 권역<input value="ALL" readOnly /></label>}
            {draft.role === "group_lead" && <fieldset className="members-country-options"><legend>관리 권역</legend>{Object.entries(COUNTRIES).map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.managed_countries.includes(value)} onChange={(event) => change({ managed_countries: event.target.checked ? [...draft.managed_countries, value] : draft.managed_countries.filter((item) => item !== value) })} />{label}</label>)}</fieldset>}
            <label>계정 상태<select aria-label="계정 상태" value={String(draft.is_active)} onChange={(event) => change({ is_active: event.target.value === "true" })}><option value="true">활성</option><option value="false">비활성</option></select></label>
            <p className="field-hint">{draft.role === "group_lead" ? "선택한 권역의 운영 인력을 관리합니다." : draft.role === "team_lead" ? "전체 권역의 운영 인력과 하위 역할의 회원을 관리합니다." : draft.role === "observer" ? "데이터를 조회할 수 있습니다." : draft.role === "admin" ? "전체 관리 기능을 사용합니다." : "운영 데이터를 조회하고 요청작업을 등록하며 본인의 요청 내용을 수정합니다."}</p>
          </>}
        </fieldset>
        {!draft.can_edit && <p className="field-hint">본인 또는 동급·상위 역할의 회원 정보는 조회만 가능합니다.</p>}
        <ErrorMessage message={formError} />
        <div className="actions"><button type="button" className="btn" onClick={close} disabled={saving}>{draft.can_edit ? "취소" : "닫기"}</button>{draft.can_edit && <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : draft.id ? "저장" : "등록"}</button>}</div>
      </form>
    </Modal>}
  </div>;
}
