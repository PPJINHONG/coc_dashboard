import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, MSG_SERVER, type FieldErrors } from '../api/client';
import AccountField from '../components/AccountField';
import ErrorMessage from '../components/ErrorMessage';
import Icon from '../components/Icon';
import './LoginPage.css';

type Mode = 'login' | 'register';

function AccessForm({ mode, onBusyChange }: { mode: Mode; onBusyChange: (busy: boolean) => void }) {
  const { login, register, notice } = useAuth();
  const signingUp = mode === 'register';
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const errors: FieldErrors = {};
    if (signingUp && !name.trim()) errors.name = ['이름을 입력해 주세요.'];
    if (!username.trim()) errors.username = ['이메일 아이디를 입력해 주세요.'];
    if (!password) errors.password = ['비밀번호를 입력해 주세요.'];
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    onBusyChange(true);
    try {
      if (signingUp) await register({ name: name.trim(), username: username.trim(), password });
      else await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setError(err.message);
      } else setError(MSG_SERVER);
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <>
      <div className="account-heading">
        <h1>{signingUp ? 'Create your account' : 'Welcome back'}</h1>
        <p>{signingUp ? '이름과 이메일, 비밀번호를 입력해 주세요.' : '계정에 로그인하고 운영 현황을 확인하세요.'}</p>
      </div>
      <ErrorMessage message={error ?? notice} />
      <form onSubmit={onSubmit} noValidate aria-busy={submitting}>
        <fieldset className="account-fields" disabled={submitting}>
          {signingUp && (
            <AccountField
              id="name" name="name" label="이름" autoComplete="name" maxLength={150}
              placeholder="이름을 입력하세요" value={name}
              onChange={(e) => setName(e.target.value)} error={fieldErrors.name?.join(' ')} required
            />
          )}
          <AccountField
            id="username" name="username" label="아이디 (이메일)" type="email"
            autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={150}
            placeholder="name@company.com" value={username}
            onChange={(e) => setUsername(e.target.value)} error={fieldErrors.username?.join(' ')} required
          />
          <AccountField
            id="password" name="password" label="비밀번호" type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            hint={signingUp ? '8자 이상으로, 문자·숫자·기호를 조합해 주세요.' : undefined}
            value={password} onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password?.join(' ')} disabled={submitting} required
          />
          <button type="submit" className="btn btn-primary account-submit" disabled={submitting}>
            {submitting ? (signingUp ? '가입 중…' : '로그인 중…') : (signingUp ? '회원가입' : '로그인')}
          </button>
        </fieldset>
      </form>
    </>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);

  return (
    <main className="access-screen">
      <section className="access-panel" aria-label="계정 접속">
        <header className="access-brand">
          <Icon name="cloud" size={30} />
          <span>COC dashboard</span>
        </header>
        <div className="access-form-area">
          <div className="access-form-content">
            <AccessForm key={mode} mode={mode} onBusyChange={setBusy} />
            <p className="access-mode-switch">
              {mode === 'login' ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
              <button type="button" disabled={busy} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? '회원가입' : '로그인'}
              </button>
            </p>
          </div>
        </div>
      </section>
      <aside className="access-identity" aria-label="Cloud Operations Center">
        <div className="access-identity-content">
          <Icon name="cloud" className="access-cloud" />
          <p>Cloud Operations Center</p>
        </div>
      </aside>
    </main>
  );
}
