import { request } from "../../shared/api/client";
import type { DataRow } from "../../shared/api/operations";

export interface IssueComment {
  id: number;
  author_name: string;
  content: string;
  created_at: string;
  /** 현재 사용자가 수정·삭제할 수 있는지(관리자 또는 작성자 본인) */
  can_edit?: boolean;
}

// 리전 이슈 사용자 작성: 관리자는 전체, 사용자는 본인 것만, 옵저버는 조회만 가능합니다.
const root = "/api/operations";
/** 이슈는 등록한 기준 월(month, YYYY-MM)에 속하며 수정해도 월은 바뀌지 않습니다. */
export const createIssue = (values: DataRow, month: string) =>
  request<{ revision: number; row: DataRow }>("POST", `${root}/issues/`, { ...values, month });
export const updateIssue = (id: number, values: DataRow) =>
  request<{ revision: number; row: DataRow }>("PATCH", `${root}/issues/${id}/`, values);
export const deleteIssue = (id: number) =>
  request("DELETE", `${root}/issues/${id}/`);
export const postIssueComment = (id: number, content: string) =>
  request("POST", `${root}/issues/${id}/comments/`, { content });
export const updateIssueComment = (id: number, content: string) =>
  request("PATCH", `${root}/issue-comments/${id}/`, { content });
export const deleteIssueComment = (id: number) =>
  request("DELETE", `${root}/issue-comments/${id}/`);

/** DB 관리 > 리전 이슈 화면의 댓글 등록(관리자 전용, 동시 수정 버전 확인) */
export const addAdminComment = (revision: number, id: number, content: string) =>
  request("POST", `/api/db-admin/issues/${id}/comments/`, {
    revision,
    content,
  });
