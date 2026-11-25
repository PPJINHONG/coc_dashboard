import AccessIdentity from "./AccessIdentity";
import { useState, type FormEvent } from "react";
import { ApiError } from "../shared/api/client";
import { useAuth } from "../shared/auth/AuthContext";
import AccountField from "../shared/components/AccountField";
import ErrorMessage from "../shared/components/ErrorMessage";
import Icon from "../shared/components/Icon";

export default function PasswordChangePage() {
  const { user, changePassword, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (password.length < 4) { setError("새 비밀번호는 4자리 이상으로 입력해 주세요."); return; }
    if (password !== confirm) { setError("비밀번호 확인이 일치하지 않습니다."); return; }
    setSaving(true); setError("");
    try {
      await changePassword(password, confirm);
    } catch (cause) {
      const field = cause instanceof ApiError ? Object.values(cause.fieldErrors).flat()[0] : undefined;
      setError(field || (cause instanceof Error ? cause.message : "비밀번호 변경 실패"));
    } finally {
      setSaving(false);
    }
  }

  return <main className="access-screen">
    <section className="access-panel" aria-label="초기 비밀번호 변경">
      <header className="access-brand"><Icon name="cloud" size={30} /><span>COC dashboard</span></header>
      <div className="access-form-area"><div className="access-form-content">
        <div className="account-heading"><h1>새 비밀번호 설정</h1><p>{user?.name} 계정의 초기 비밀번호 변경 필요</p></div>
        <ErrorMessage message={error} />
        <form onSubmit={submit}>
          <fieldset className="account-fields" disabled={saving}>
            <AccountField id="new-password" name="new-password" label="새 비밀번호" type="password" autoComplete="new-password" hint="특수문자 조건 없이 4자리 이상" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <AccountField id="confirm-password" name="confirm-password" label="새 비밀번호 확인" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            <button className="btn btn-primary account-submit" disabled={saving}>{saving ? "변경 중…" : "비밀번호 변경"}</button>
            <button type="button" className="btn password-change-logout" disabled={saving} onClick={() => void logout()}>로그아웃</button>
          </fieldset>
        </form>
      </div></div>
    </section>
    <AccessIdentity />
  </main>;
}
