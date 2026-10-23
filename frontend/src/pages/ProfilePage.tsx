import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { User } from '../api/auth';
import { ApiError, MSG_INVALID_INPUT, MSG_SERVER } from '../api/client';
import ErrorMessage from '../components/ErrorMessage';

const MSG_EMAIL = '올바른 이메일 형식이 아닙니다.';
const MSG_SAVED = '저장되었습니다.';

type EditableField = 'first_name' | 'last_name' | 'email';
type FormState = Record<EditableField, string>;
type FieldMessages = Partial<Record<EditableField, string>>;

const FIELDS: { key: EditableField; label: string; type: string; autoComplete: string }[] = [
  { key: 'last_name', label: '성', type: 'text', autoComplete: 'family-name' },
  { key: 'first_name', label: '이름', type: 'text', autoComplete: 'given-name' },
  { key: 'email', label: '이메일', type: 'email', autoComplete: 'email' },
];

function toForm(user: User): FormState {
  return { first_name: user.first_name, last_name: user.last_name, email: user.email };
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('ko-KR');
}

export default function ProfilePage({ user }: { user: User }) {
  const { updateUser } = useAuth();
  const [form, setForm] = useState<FormState>(() => toForm(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldMessages>({});
  const [success, setSuccess] = useState<string | null>(null);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    try {
      const updated = await updateUser({ ...form });
      setForm(toForm(updated));
      setSuccess(MSG_SAVED);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setError(MSG_SERVER);
      } else if (err.status === 403) {
        return; // AuthContext가 anon 전환 + 안내 처리
      } else if (err.status === 400) {
        const next: FieldMessages = {};
        for (const f of FIELDS) {
          const msgs = err.fieldErrors[f.key];
          if (msgs && msgs.length > 0) next[f.key] = f.key === 'email' ? MSG_EMAIL : msgs[0];
        }
        setFieldErrors(next);
        const summary = Object.values(next).join(' ');
        setError(summary ? `${MSG_INVALID_INPUT} ${summary}` : err.message);
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="card">
      <h1>내 프로필</h1>
      <ErrorMessage message={error} />
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      <dl>
        <dt>아이디</dt>
        <dd>{user.username}</dd>
        <dt>가입일</dt>
        <dd>{formatDate(user.date_joined)}</dd>
      </dl>
      <form onSubmit={onSave} noValidate>
        {FIELDS.map((f) => (
          <div key={f.key} className="field">
            <label htmlFor={f.key}>{f.label}</label>
            <input
              id={f.key}
              name={f.key}
              type={f.type}
              autoComplete={f.autoComplete}
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              aria-invalid={fieldErrors[f.key] ? true : undefined}
              aria-describedby={fieldErrors[f.key] ? `${f.key}-error` : undefined}
              disabled={saving}
            />
            <ErrorMessage id={`${f.key}-error`} message={fieldErrors[f.key]} />
          </div>
        ))}
        <div className="actions">
          <button type="submit" disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </main>
  );
}
