import { request } from "../../shared/api/client";
import type { DataRow } from "../../shared/api/operations";

/**
 * 운영 인력 탭 편집 저장(관리자·팀장·그룹장). 편집 가능한 국가의 행 전체를 보내며,
 * 보낸 목록에서 빠진 그 국가 행은 삭제됩니다. 다른 국가 행은 바뀌지 않습니다.
 */
export const saveStaff = (revision: number, rows: DataRow[]) =>
  request<{ revision: number; rows: DataRow[] }>("PUT", "/api/operations/staff/", { revision, rows });
