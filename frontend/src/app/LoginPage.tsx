import AccessIdentity from "./AccessIdentity";
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, MSG_SERVER, type FieldErrors } from '../shared/api/client';
import { checkInvite, clearInviteFromUrl, inviteTokenFromUrl } from '../shared/api/invites';
import { useAuth } from '../shared/auth/AuthContext';
import AccountField from '../shared/components/AccountField';
import ErrorMessage from '../shared/components/ErrorMessage';
import Icon from '../shared/components/Icon';
import './login.css';

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
      .then((info) => { if (!cancelled) setState({ kind: 'valid', inviter: info.inviter_name, expiresAt: info.expires_at }); })
      .catch((err) => {
        if (!cancelled) setState({ kind: 'invalid', message: err instanceof ApiError && err.status === 404 ? err.message : MSG_SERVER });
      });
    return () => { cancelled = true; };
  }, [token, enabled]);
  return state;
}

function AccessForm({ mode, inviteToken, onBusyChange }: {
  mode: Mode;
  inviteToken: string | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const { login, register, notice } = useAuth();
  const signingUp = mode === 'register';
  const invite = useInvite(inviteToken, signingUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = ['이름을 입력해 주세요.'];
    if (signingUp && !email.trim()) errors.email = ['이메일을 입력해 주세요.'];
    if (!password) errors.password = ['비밀번호를 입력해 주세요.'];
    else if (signingUp && password.length < 4) errors.password = ['비밀번호는 4자리 이상으로 입력해 주세요.'];
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    onBusyChange(true);
    try {
      if (signingUp) {
        await register({ name: name.trim(), email: email.trim(), password, invite: inviteToken ?? '' });
        clearInviteFromUrl();
      } else {
        await login(name.trim(), password);
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setFieldErrors(cause.fieldErrors);
        setError(cause.fieldErrors.invite?.join(' ') ?? cause.message);
      } else {
        setError(MSG_SERVER);
      }
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  if (signingUp && invite.kind !== 'valid') {
    return <>
      <div className="account-heading"><h1>Create your account</h1><p>관리자가 발급한 초대 링크를 통한 회원가입</p></div>
      {invite.kind === 'checking'
        ? <p role="status" className="invite-banner">초대 링크 확인 중…</p>
        : <div className="invite-banner invite-banner-warn" role="alert">{invite.kind === 'invalid' ? invite.message : '초대 링크 없음 · 관리자에게 초대 링크 요청 필요'}</div>}
    </>;
  }

  return <>
    <div className="account-heading">
      <h1>{signingUp ? 'Create your account' : 'Welcome back'}</h1>
      <p>{signingUp ? '이름·이메일·비밀번호로 계정 생성' : '가입할 때 등록한 이름으로 로그인'}</p>
    </div>
    {signingUp && invite.kind === 'valid' && <p className="invite-banner" role="status"><strong>{invite.inviter}</strong> 관리자 초대 · {formatUntil(invite.expiresAt)}까지 가입 가능</p>}
    <ErrorMessage message={error ?? notice} />
    <form onSubmit={onSubmit} noValidate aria-busy={submitting}>
      <fieldset className="account-fields" disabled={submitting}>
        <AccountField
          id="name" name="name" label={signingUp ? '이름' : '로그인 이름'} autoComplete="username" maxLength={150}
          placeholder={signingUp ? '사용할 이름 입력' : '이름으로 로그인'} value={name}
          onChange={(event) => setName(event.target.value)} error={fieldErrors.name?.join(' ') ?? fieldErrors.username?.join(' ')} required
        />
        {signingUp && <AccountField
          id="email" name="email" label="이메일" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254}
          placeholder="name@company.com" value={email}
          onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email?.join(' ')} required
        />}
        <AccountField
          id="password" name="password" label="비밀번호" type="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          hint={signingUp ? '특수문자 조건 없이 4자리 이상' : undefined}
          value={password} onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password?.join(' ')} disabled={submitting} required
        />
        {!signingUp && <p className="password-help">비밀번호 분실 시 관리자에게 초기화 요청</p>}
        <button type="submit" className="btn btn-primary account-submit" disabled={submitting}>
          {submitting ? (signingUp ? '가입 중…' : '로그인 중…') : (signingUp ? '회원가입' : '로그인')}
        </button>
        {signingUp && <p className="invite-privacy">이메일은 회원 확인용 정보이며 로그인에는 이름 사용</p>}
      </fieldset>
    </form>
  </>;
}

export default function LoginPage() {
  const [inviteToken] = useState(inviteTokenFromUrl);
  const [mode, setMode] = useState<Mode>(inviteToken ? 'register' : 'login');
  const [busy, setBusy] = useState(false);
  return <main className="access-screen">
    <section className="access-panel" aria-label="계정 접속">
      <header className="access-brand"><Icon name="cloud" size={30} /><span>COC dashboard</span></header>
      <div className="access-form-area"><div className="access-form-content">
        <AccessForm key={mode} mode={mode} inviteToken={inviteToken} onBusyChange={setBusy} />
        <p className="access-mode-switch">
          {mode === 'login' ? '계정이 없는 경우' : '이미 가입한 경우'}{' '}
          <button type="button" disabled={busy} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '회원가입' : '로그인'}</button>
        </p>
      </div></div>
    </section>
    <AccessIdentity />
  </main>;
}
