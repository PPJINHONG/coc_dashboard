import { request } from './client';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  date_joined: string;
  is_staff: boolean;
}

export interface Registration {
  name: string;
  username: string;
  password: string;
  invite: string;
}

export type UserUpdate = Partial<Pick<User, 'name' | 'username'>> & {
  password?: string;
  current_password?: string;
};

export function register(data: Registration): Promise<User> {
  return request<User>('POST', '/api/auth/register/', data);
}

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
