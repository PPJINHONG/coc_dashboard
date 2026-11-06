import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import type { Registration, User } from "../api/auth";
import { ApiError, MSG_SERVER, MSG_SESSION, request } from "../api/client";

export type AuthStatus = "loading" | "anon" | "authed";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  // anon 전환 사유 안내(세션 만료, 서버 오류 등)
  notice: string | null;
  login: (username: string, password: string) => Promise<User>;
  register: (data: Registration) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const developmentMode = useRef(false);

  const toAnon = useCallback((message: string | null) => {
    setUser(null);
    setStatus(developmentMode.current ? "authed" : "anon");
    setNotice(message);
  }, []);

  // 마운트 시 세션 복원
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await request<{ development_mode: boolean }>(
          "GET",
          "/api/app-config/",
        );
        if (cancelled) return;
        developmentMode.current = config.development_mode;
        const me = await authApi.getMe();
        if (cancelled) return;
        setUser(me);
        setStatus("authed");
      } catch (err) {
        if (cancelled) return;
        const isAuthError =
          err instanceof ApiError && (err.status === 401 || err.status === 403);
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
    setStatus("authed");
    setNotice(null);
    return me;
  }, []);

  const register = useCallback(async (data: Registration) => {
    const me = await authApi.register(data);
    setUser(me);
    setStatus("authed");
    setNotice(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      toAnon(null);
    } catch (err) {
      toAnon(
        err instanceof ApiError && err.status === 403 ? MSG_SESSION : null,
      );
    }
  }, [toAnon]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, notice, login, register, logout }),
    [status, user, notice, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
