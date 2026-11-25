import { request } from './client';

export interface User {
  id: number;
  name: string;
  /** 로그인 이름. name과 같은 값으로 서버에서 관리합니다. */
  username: string;
  email: string;
  date_joined: string;
  is_staff: boolean;
  role?: 'admin' | 'user' | null;
  managed_countries?: string[];
  staff_edit_countries?: string[];
  must_change_password: boolean;
}

export interface Registration {
  name: string;
  email: string;
  password: string;
  invite: string;
}

export function register(data: Registration): Promise<User> {
  return request<User>('POST', '/api/auth/register/', data);
}

export function login(name: string, password: string): Promise<User> {
  return request<User>('POST', '/api/auth/login/', { username: name, password });
}

export function changePassword(password: string, confirmPassword: string): Promise<User> {
  return request<User>('POST', '/api/auth/password/', { password, confirm_password: confirmPassword });
}

export function logout(): Promise<void> {
  return request<void>('POST', '/api/auth/logout/');
}

export function getMe(): Promise<User> {
  return request<User>('GET', '/api/me/');
}
