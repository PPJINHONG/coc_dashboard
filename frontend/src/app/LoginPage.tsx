import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, MSG_SERVER, request, type FieldErrors } from '../shared/api/client';
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
  const [country, setCountry] = useState('');
  // 운영 인력에 함께 등록할 본인 정보(선택). 근무지는 국가별로 등록된 값만 고릅니다.
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [places, setPlaces] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!signingUp || invite.kind !== 'valid' || !inviteToken) return;
    request<{ work_locations: Record<string, string[]> }>('GET', `/api/operations/staff/signup-options/${encodeURIComponent(inviteToken)}/`)
      .then((value) => setPlaces(value.work_locations)).catch(() => setPlaces({}));
  }, [signingUp, invite.kind, inviteToken]);
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
    if (signingUp && !country) errors.country_code = ['국가를 선택해 주세요.'];
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    onBusyChange(true);
    try {
      if (signingUp) {
        await register({ name: name.trim(), username: username.trim(), password, country_code: country, invite: inviteToken ?? '',
          staff: Object.fromEntries(Object.entries(staff).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)) });
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
        <p>{signingUp ? '이름과 이메일, 비밀번호, 근무 국가를 입력하면 바로 시작합니다.' : '계정에 로그인하고 운영 현황을 확인하세요.'}</p>
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
            id="username" name="username" label="아이디 (이메일)" type={signingUp ? 'email' : 'text'}
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
          {signingUp && (
            <div className="field account-field">
              <label htmlFor="country_code">근무 국가</label>
              <select
                id="country_code" name="country_code" value={country} required
                aria-invalid={fieldErrors.country_code ? true : undefined}
                aria-describedby="country_code-hint country_code-error"
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="" disabled>국가를 선택하세요</option>
                <option value="KR">KR · 내수</option>
                <option value="EU">EU · 유럽</option>
                <option value="NA">NA · 북미</option>
              </select>
              <p className="field-hint" id="country_code-hint">가입하면 이 국가의 운영 인력으로 바로 등록됩니다.</p>
              <ErrorMessage id="country_code-error" message={fieldErrors.country_code?.join(' ')} />
            </div>
          )}
          {signingUp && (
            <fieldset className="account-staff">
              <legend>운영 인력 정보 <small>선택 · 가입 후 운영 인력 탭에서 수정할 수 있습니다</small></legend>
              <div className="field account-field">
                <label htmlFor="work_location">근무지</label>
                <select id="work_location" value={staff.work_location ?? ''} disabled={!country} onChange={(e) => setStaff({ ...staff, work_location: e.target.value })}>
                  <option value="">{country ? (places[country]?.length ? '선택 안 함' : '등록된 근무지 없음') : '국가를 먼저 선택하세요'}</option>
                  {(places[country] ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              {([['job_description', '업무', 500], ['pc_ip', 'PC IP', 45], ['autoever_account', '오토에버 계정', 40], ['z_account', 'Z 계정', 40]] as const).map(([key, label, max]) => (
                <AccountField key={key} id={key} name={key} label={label} maxLength={max} value={staff[key] ?? ''} onChange={(e) => setStaff({ ...staff, [key]: e.target.value })} />
              ))}
              <ErrorMessage message={fieldErrors.staff?.join(' ')} />
            </fieldset>
          )}
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
