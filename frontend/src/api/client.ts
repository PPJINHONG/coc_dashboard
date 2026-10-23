// fetch 래퍼: 세션 쿠키 + CSRF 처리, 모든 실패를 ApiError로 정규화
export type FieldErrors = Record<string, string[]>;
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export const MSG_SERVER = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
export const MSG_SESSION = '세션이 만료되었습니다. 다시 로그인해 주세요.';
export const MSG_INVALID_INPUT = '입력값을 확인해 주세요.';

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldErrors;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// 쿠키 값 읽기 (로그인/로그아웃 시 토큰이 회전하므로 매번 새로 읽는다)
export function getCookie(name: string): string | null {
  const prefix = name + '=';
  for (const part of document.cookie.split(';')) {
    const c = part.trim();
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length));
  }
  return null;
}

async function fetchCsrf(): Promise<void> {
  try {
    await fetch('/api/auth/csrf/', { method: 'GET', credentials: 'include' });
  } catch {
    throw new ApiError(0, MSG_SERVER);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toApiError(status: number, data: unknown): ApiError {
  if (status >= 500) return new ApiError(status, MSG_SERVER);
  const fieldErrors: FieldErrors = {};
  let detail: string | null = null;
  if (isRecord(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'detail' && typeof value === 'string') {
        detail = value;
      } else if (Array.isArray(value)) {
        fieldErrors[key] = value.filter((m): m is string => typeof m === 'string');
      } else if (typeof value === 'string') {
        fieldErrors[key] = [value];
      }
    }
  }
  if (status === 403) return new ApiError(status, MSG_SESSION, fieldErrors);
  if (status === 400) return new ApiError(status, detail ?? MSG_INVALID_INPUT, fieldErrors);
  return new ApiError(status, detail ?? MSG_SERVER, fieldErrors);
}

export async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (method !== 'GET') {
    let token = getCookie('csrftoken');
    if (!token) {
      await fetchCsrf();
      token = getCookie('csrftoken');
    }
    if (token) headers['X-CSRFToken'] = token;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, MSG_SERVER);
  }

  let text = '';
  try {
    text = await res.text();
  } catch {
    throw new ApiError(res.status || 0, MSG_SERVER);
  }

  // 비JSON 응답(예: Nginx 502 HTML)은 undefined로 표시
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (res.ok) {
    if (res.status === 204 || !text) return undefined as T;
    if (data === undefined) throw new ApiError(res.status, MSG_SERVER);
    return data as T;
  }
  throw toApiError(res.status, data);
}
