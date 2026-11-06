import { sectionRows } from "../../shared/api/operations";
import type { AdminTabProps } from "../../shared/feature";
import RecordsAdmin, { type RecordsConfig } from "../../shared/sections/RecordsAdmin";

/** DB 관리 > 기능별 설정 > 이슈 댓글: 일반 이슈 화면과 같은 댓글 데이터를 관리합니다. */
const config: RecordsConfig = {
  collection: "comments",
  title: "이슈 댓글 관리",
  subtitle: "일반 이슈 화면과 같은 댓글 데이터를 추가·수정·삭제합니다.",
  addLabel: "+ 댓글 추가",
  noun: "댓글",
  deleteTitle: "댓글 삭제",
  columns: [
    ["issue_title", "이슈"],
    ["author_name", "작성자"],
    ["content", "댓글"],
    ["created_at", "등록 시각"],
  ],
  fields: ({ rows, snapshot }) => [
    {
      key: "issue",
      label: "이슈",
      options: [
        ...new Map([
          ...sectionRows(snapshot, "issues").map(
            (row) => [String(row.id), String(row.title)] as [string, string],
          ),
          ...rows.map(
            (row) =>
              [String(row.issue), String(row.issue_title)] as [string, string],
          ),
        ]).entries(),
      ],
    },
    { key: "author_name", label: "작성자 이름" },
    {
      key: "author_username",
      label: "작성자 아이디",
      optional: true,
      default: "",
    },
    { key: "content", label: "댓글 내용", type: "textarea" },
  ],
  renderCell: (key, row) =>
    key === "created_at"
      ? row[key]
        ? new Date(String(row[key])).toLocaleString("ko-KR")
        : "—"
      : undefined,
  deleteLabel: (row) => `댓글 #${row.id}`,
};

export default function CommentsAdmin(props: AdminTabProps) {
  return <RecordsAdmin config={config} {...props} />;
}
