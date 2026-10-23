import { request } from './client';

export interface User {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  date_joined: string;
}

// 수정 가능한 필드만 (username·date_joined는 읽기전용)
export type UserUpdate = Partial<Pick<User, 'first_name' | 'last_name' | 'email'>>;

export function login(username: string, password: string): Promise<User> {
  return request<User>('POST', '/api/auth/login/', { username, password });
}

export function logout(): Promise<void> {
  return request<void>('POST', '/api/auth/logout/');
}

export function getMe(): Promise<User> {
  return request<User>('GET', '/api/me/');
}

export function updateMe(partial: UserUpdate): Promise<User> {
  return request<User>('PATCH', '/api/me/', partial);
}
