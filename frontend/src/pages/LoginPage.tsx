import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, MSG_SERVER, type FieldErrors } from '../api/client';
import { checkInvite, clearInviteFromUrl, inviteTokenFromUrl } from '../api/invites';
import AccountField from '../components/AccountField';
import ErrorMessage from '../components/ErrorMessage';
import Icon from '../components/Icon';
import './LoginPage.css';

type Mode = 'login' | 'register';
type InviteState =
  | { kind: 'none' }
  | { kind: 'checking' }
  | { kind: 'valid'; inviter: string; expiresAt: string }
  | { kind: 'invalid'; message: string };

function formatUntil(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function useInvite(token: string | null, enabled: boolean): InviteState {
  const [state, setState] = useState<InviteState>(token ? { kind: 'checking' } : { kind: 'none' });
  useEffect(() => {
    if (!token || !enabled) return;
    let cancelled = false;
    setState({ kind: 'checking' });
    checkInvite(token)
      .then((info) => {
        if (!cancelled) setState({ kind: 'valid', inviter: info.inviter_name, expiresAt: info.expires_at });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ kind: 'invalid', message: err instanceof ApiError && err.status === 404 ? err.message : MSG_SERVER });
      });
    return () => {
      cancelled = true;
    };
  }, [token, enabled]);
  return state;
}

function AccessForm({
  mode, inviteToken, onBusyChange,
}: { mode: Mode; inviteToken: string | null; onBusyChange: (busy: boolean) => void }) {
  const { login, register, notice } = useAuth();
  const signingUp = mode === 'register';
  const invite = useInvite(inviteToken, signingUp);
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
      if (signingUp) {
        await register({ name: name.trim(), username: username.trim(), password, invite: inviteToken ?? '' });
        clearInviteFromUrl();
      } else await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setError(err.fieldErrors.invite?.join(' ') ?? err.message);
      } else setError(MSG_SERVER);
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  if (signingUp && invite.kind !== 'valid') {
    return (
      <>
        <div className="account-heading">
          <h1>Create your account</h1>
          <p>회원가입은 팀원이 보낸 초대 링크로만 할 수 있습니다.</p>
        </div>
        {invite.kind === 'checking' ? (
          <p role="status" className="invite-banner">초대 링크를 확인하고 있습니다…</p>
        ) : (
          <div className="invite-banner invite-banner-warn" role="alert">
            {invite.kind === 'invalid'
              ? invite.message
              : '초대 링크가 없습니다. 팀원에게 초대 링크를 받아 그 링크로 열어 주세요. 이미 로그인한 팀원은 왼쪽 메뉴의 "팀원 초대"에서 링크를 만들 수 있습니다.'}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="account-heading">
        <h1>{signingUp ? 'Create your account' : 'Welcome back'}</h1>
        <p>{signingUp ? '이름과 이메일, 비밀번호만 입력하면 바로 시작합니다.' : '계정에 로그인하고 운영 현황을 확인하세요.'}</p>
      </div>
      {signingUp && invite.kind === 'valid' && (
        <p className="invite-banner" role="status">
          <strong>{invite.inviter}</strong>님이 초대했습니다 · {formatUntil(invite.expiresAt)}까지 가입할 수 있습니다.
        </p>
      )}
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
          {signingUp && (
            <p className="invite-privacy">입력한 이름과 이메일은 팀 내 계정 확인에만 쓰이며, 탈퇴할 때까지 보관합니다.</p>
          )}
        </fieldset>
      </form>
    </>
  );
}

export default function LoginPage() {
  const [inviteToken] = useState(inviteTokenFromUrl);
  const [mode, setMode] = useState<Mode>(inviteToken ? 'register' : 'login');
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
            <AccessForm key={mode} mode={mode} inviteToken={inviteToken} onBusyChange={setBusy} />
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
