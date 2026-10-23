// 날짜 문자열을 한국어 로케일로 표시. 파싱 실패 시 원본을 그대로 반환한다.
export function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('ko-KR');
}
