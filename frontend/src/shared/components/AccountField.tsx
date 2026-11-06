import { useState, type InputHTMLAttributes } from 'react';
import ErrorMessage from './ErrorMessage';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

export default function AccountField({ id, label, hint, error, type = 'text', ...input }: Props) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field account-field">
      <label htmlFor={id}>{label}</label>
      <div className={password ? 'account-input has-toggle' : 'account-input'}>
        <input
          {...input}
          id={id}
          type={password && visible ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {password && (
          <button
            type="button"
            className="password-toggle"
            aria-label={`${label} ${visible ? '숨기기' : '보기'}`}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
            disabled={input.disabled}
          >
            {visible ? '숨김' : '보기'}
          </button>
        )}
      </div>
      {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      <ErrorMessage id={`${id}-error`} message={error} />
    </div>
  );
}
