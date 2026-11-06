import { useState, type FormEvent } from "react";
import AccountField from "../components/AccountField";
import ErrorMessage from "../components/ErrorMessage";
import { errorMessage } from "../errors";
import { useAuth } from "./AuthContext";
import "./admin-login.css";

/** 관리자 로그인 폼. 관리자 권한이 없는 계정은 안내만 보여 줍니다. */
export default function AdminLogin({ onSuccess }: { onSuccess?: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin"),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      if (!user.is_staff) {
        setError(
          "관리자 권한이 없는 계정입니다. 관리자 계정으로 로그인하세요.",
        );
        return;
      }
      setPassword("");
      onSuccess?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="db-login">
      <p className="report-notice">
        DB 관리에는 실제 관리자 로그인이 필요합니다. 일반 운영 화면은 개발
        모드에서 로그인 없이 이용할 수 있습니다.
      </p>
      <form onSubmit={submit} noValidate>
        <fieldset className="account-fields" disabled={busy}>
          <AccountField
            id="db-admin-email"
            label="관리자 아이디"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <AccountField
            id="db-admin-password"
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
          <ErrorMessage message={error} />
          <button
            className="btn btn-primary"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? "확인 중…" : "관리자 로그인"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
