import { request } from './client';

export type InviteStatus = 'active' | 'revoked' | 'expired' | 'used_up';

export interface Invite {
  id: number;
  token_hint: string;
  created_by_name: string;
  created_at: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  status: InviteStatus;
  joined: string[];
}

export interface CreatedInvite extends Invite {
  token: string;
}

export interface InviteCheck {
  status: 'active';
  inviter_name: string;
  expires_at: string;
}

// 고를 수 있는 기간·인원은 서버가 권한에 따라 정합니다(일반 1일·10명, 관리자 1·7·30일·50·100·200명).
export interface InviteOptions {
  expires_days: number[];
  max_uses: number[];
  default_expires_days: number;
  default_max_uses: number;
}

export const STATUS_LABELS: Record<InviteStatus, string> = {
  active: '사용 가능',
  revoked: '취소됨',
  expired: '기간 지남',
  used_up: '인원 마감',
};

export function inviteLink(token: string): string {
  return `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
}

// 주소창의 ?invite= 값을 읽습니다.
export function inviteTokenFromUrl(): string | null {
  const token = new URLSearchParams(window.location.search).get('invite');
  return token && token.trim() ? token.trim() : null;
}

// 가입이 끝나면 주소창에서 초대 토큰을 지웁니다.
export function clearInviteFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('invite')) return;
  url.searchParams.delete('invite');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function checkInvite(token: string): Promise<InviteCheck> {
  return request<InviteCheck>('GET', `/api/auth/invites/${encodeURIComponent(token)}/`);
}

export function listInvites(): Promise<Invite[]> {
  return request<Invite[]>('GET', '/api/invites/');
}

export function getInviteOptions(): Promise<InviteOptions> {
  return request<InviteOptions>('GET', '/api/invites/options/');
}

export function createInvite(expires_days: number, max_uses: number): Promise<CreatedInvite> {
  return request<CreatedInvite>('POST', '/api/invites/', { expires_days, max_uses });
}

export function revokeInvite(id: number): Promise<Invite> {
  return request<Invite>('POST', `/api/invites/${id}/revoke/`);
}
