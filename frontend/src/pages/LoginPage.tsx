import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, MSG_SERVER } from '../api/client';
import ErrorMessage from '../components/ErrorMessage';

const MSG_EMPTY = '아이디와 비밀번호를 입력해 주세요.';
const MSG_BAD_CREDENTIALS = '아이디 또는 비밀번호가 올바르지 않습니다.';

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) return MSG_SERVER;
  if (err.status === 401) return MSG_BAD_CREDENTIALS;
  if (err.status === 400) return MSG_EMPTY;
  return err.message;
}

export default function LoginPage() {
  const { login, notice } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!username.trim() || !password) {
      setError(MSG_EMPTY);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(messageFor(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="card">
      <div className="auth-brand">
        <div className="sidebar-logo" aria-hidden="true">◆</div>
        <div className="sidebar-title">
          <span className="name">COC Dashboard</span>
          <span className="sub">OPERATIONS CONSOLE</span>
        </div>
      </div>

      <h1>로그인</h1>
      <ErrorMessage message={error ?? notice} />
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="username">아이디</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </main>
  );
}
