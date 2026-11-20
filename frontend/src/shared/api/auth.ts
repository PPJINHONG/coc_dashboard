import { request } from './client';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  date_joined: string;
  is_staff: boolean;
  /** admin: 관리자, observer: 옵저버(읽기 전용), user: 사용자 */
  role?: 'admin' | 'team_lead' | 'group_lead' | 'observer' | 'user' | null;
  /** 그룹장의 관리 국가(KR·EU·NA) */
  managed_countries?: string[];
  /** 운영 인력 탭에서 편집할 수 있는 국가. 관리자·팀장은 전체, 그룹장은 관리 국가, 그 외는 빈 목록 */
  staff_edit_countries?: string[];
}

export interface Registration {
  name: string;
  username: string;
  password: string;
  /** 가입과 함께 운영 인력으로 등록할 국가 */
  country_code: string;
  invite: string;
  /** 운영 인력에 함께 저장할 본인 정보(업무·근무지·PC IP·오토에버·Z 계정). 비운 항목은 보내지 않습니다. */
  staff?: Record<string, string>;
}

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
