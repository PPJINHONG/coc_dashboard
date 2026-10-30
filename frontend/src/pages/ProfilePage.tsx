import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { User, UserUpdate } from '../api/auth';
import { ApiError, MSG_SERVER, type FieldErrors } from '../api/client';
import AccountField from '../components/AccountField';
import ErrorMessage from '../components/ErrorMessage';

export default function ProfilePage({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const identityChanged = username.trim().toLowerCase() !== user.username || password.length > 0;
  const dirty = name.trim() !== user.name || username.trim().toLowerCase() !== user.username || password.length > 0;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !dirty) return;
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = ['이름을 입력해 주세요.'];
    if (!username.trim()) errors.username = ['이메일 아이디를 입력해 주세요.'];
    if (identityChanged && !currentPassword) errors.current_password = ['현재 비밀번호를 입력해 주세요.'];
    setFieldErrors(errors);
    setError(null);
    setSuccess(null);
    if (Object.keys(errors).length) return;
    setSaving(true);
    const changes: UserUpdate = { name: name.trim() };
    if (username.trim().toLowerCase() !== user.username) changes.username = username.trim();
    if (password) changes.password = password;
    if (identityChanged) changes.current_password = currentPassword;
    try {
      const updated = await updateUser(changes);
      setName(updated.name);
      setUsername(updated.username);
      setPassword('');
      setCurrentPassword('');
      setSuccess('회원정보가 저장되었습니다.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) return;
        setFieldErrors(err.fieldErrors);
        setError(err.message);
      } else setError(MSG_SERVER);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <header className="section-head">
        <div className="section-title">
          <div className="section-ico" aria-hidden="true">⚙</div>
          <div>
            <h1 id="profile-title">내 프로필</h1>
            <p className="section-sub">회원정보와 로그인 정보를 관리하세요.</p>
          </div>
        </div>
        {user.is_staff && <span className="badge badge-author">관리자</span>}
      </header>
      <div className="profile-card panel">
        <div className="account-heading">
          <h2>회원정보</h2>
          <p>아이디를 변경하면 다음 로그인부터 변경한 이메일을 사용합니다.</p>
        </div>
        <ErrorMessage message={error} />
        {success && <p role="status" className="success account-success">{success}</p>}
        <form onSubmit={onSave} noValidate aria-busy={saving}>
          <fieldset className="account-fields" disabled={saving}>
            <AccountField
              id="profile-name" name="name" label="이름" autoComplete="name" maxLength={150}
              value={name} onChange={(e) => { setName(e.target.value); setSuccess(null); }}
              error={fieldErrors.name?.join(' ')} required
            />
            <AccountField
              id="profile-username" name="username" label="아이디 (이메일)" type="email"
              autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={150}
              value={username} onChange={(e) => { setUsername(e.target.value); setSuccess(null); }}
              error={fieldErrors.username?.join(' ')} required
            />
            <div className="account-divider" />
            <AccountField
              id="profile-password" name="password" label="새 비밀번호" type="password" autoComplete="new-password"
              hint="변경할 때만 입력하세요. 8자 이상으로 설정해 주세요."
              value={password} onChange={(e) => { setPassword(e.target.value); setSuccess(null); }}
              error={fieldErrors.password?.join(' ')} disabled={saving}
            />
            {identityChanged && (
              <AccountField
                id="profile-current-password" name="current_password" label="현재 비밀번호"
                type="password" autoComplete="current-password" hint="아이디·비밀번호 변경을 위해 본인 확인이 필요합니다."
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                error={fieldErrors.current_password?.join(' ')} disabled={saving} required
              />
            )}
            <div className="profile-actions">
              <p className="field-hint">가입일 {new Date(user.date_joined).toLocaleDateString('ko-KR')}</p>
              <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
                {saving ? '저장 중…' : '변경사항 저장'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}
