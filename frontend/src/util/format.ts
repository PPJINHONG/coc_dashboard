// 날짜 문자열을 한국어 로케일로 표시. 파싱 실패 시 원본을 그대로 반환한다.
export function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('ko-KR');
}

// 상대 시간("n분 전"). 파싱 실패 시 formatDate로 대체한다.
export function formatRelative(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 0) return '방금 전';
  if (diffSec < 60) return '방금 전';

  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;

  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;

  // 일주일 이상은 절대 날짜(YYYY-MM-DD)로 표시한다.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
