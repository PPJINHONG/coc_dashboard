import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import type { User, UserUpdate } from '../api/auth';
import { ApiError, MSG_SERVER, MSG_SESSION } from '../api/client';

export type AuthStatus = 'loading' | 'anon' | 'authed';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  // anon 전환 사유 안내(세션 만료, 서버 오류 등)
  notice: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: UserUpdate) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toAnon = useCallback((message: string | null) => {
    setUser(null);
    setStatus('anon');
    setNotice(message);
  }, []);

  // 마운트 시 세션 복원
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authApi.getMe();
        if (cancelled) return;
        setUser(me);
        setStatus('authed');
      } catch (err) {
        if (cancelled) return;
        const isAuthError = err instanceof ApiError && (err.status === 401 || err.status === 403);
        toAnon(isAuthError ? null : MSG_SERVER);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toAnon]);

  const login = useCallback(async (username: string, password: string) => {
    const me = await authApi.login(username, password);
    setUser(me);
    setStatus('authed');
    setNotice(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      toAnon(null);
    } catch (err) {
      toAnon(err instanceof ApiError && err.status === 403 ? MSG_SESSION : null);
    }
  }, [toAnon]);

  const updateUser = useCallback(
    async (partial: UserUpdate) => {
      try {
        const updated = await authApi.updateMe(partial);
        setUser(updated);
        return updated;
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) toAnon(MSG_SESSION);
        throw err;
      }
    },
    [toAnon],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, notice, login, logout, updateUser }),
    [status, user, notice, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
