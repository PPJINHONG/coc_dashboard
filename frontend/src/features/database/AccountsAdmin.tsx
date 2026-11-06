import Modal from "../../shared/components/Modal";
import type { AdminTabProps } from "../../shared/feature";
import RecordsAdmin, { type RecordsConfig } from "../../shared/sections/RecordsAdmin";
import ActivityHistory from "./ActivityHistory";

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  observer: "옵저버(읽기 전용)",
  user: "사용자",
};

/** DB 관리 > 기능별 설정 > 사용자·권한: 계정·권한·로그인 상태와 계정별 행동 이력. */
const config: RecordsConfig = {
  collection: "accounts",
  title: "사용자·아이디·권한",
  subtitle:
    "권한(관리자·옵저버·사용자)과 로그인 상태를 확인하고, ‘이력’에서 계정별 행동과 변경 전·후 값을 확인합니다.",
  addLabel: "+ 사용자 추가",
  noun: "사용자",
  deleteTitle: "계정 삭제",
  columns: [
    ["name", "이름"],
    ["username", "이메일 아이디"],
    ["role", "권한"],
    ["is_active", "상태"],
    ["is_online", "로그인"],
    ["last_activity", "최근 활동"],
  ],
  fields: ({ editing }) => [
    { key: "name", label: "이름" },
    { key: "username", label: "이메일 아이디", type: "email" },
    {
      key: "role",
      label: "권한",
      options: [
        ["user", "사용자 (글 작성·본인 데이터 수정·삭제)"],
        ["observer", "옵저버 (읽기 전용)"],
        ["admin", "관리자 (전체 수정·삭제·이력 확인)"],
      ],
      default: "user",
    },
    {
      key: "is_active",
      label: "계정 상태",
      options: [
        ["true", "활성"],
        ["false", "비활성"],
      ],
      default: true,
    },
    {
      key: "password",
      label: editing ? "새 비밀번호 (변경할 때만 입력)" : "비밀번호",
      type: "password",
      optional: Boolean(editing),
    },
  ],
  renderCell: (key, row) =>
    key === "role" ? (
      ROLE_LABELS[String(row[key])] ?? String(row[key] ?? "")
    ) : key === "is_online" ? (
      row[key] ? (
        <span className="report-badge status-open">로그인 중 ({String(row.active_sessions)}세션)</span>
      ) : (
        <span className="muted">로그아웃</span>
      )
    ) : key === "is_active" ? (
      row[key] ? "활성" : "비활성"
    ) : key === "last_activity" ? (
      row[key] ? new Date(String(row[key])).toLocaleString("ko-KR") : "—"
    ) : undefined,
  // 비밀번호는 복사하지 않고 새 아이디·비밀번호를 입력합니다. 복사한 계정은 일반 사용자입니다.
  copyValues: (values) => ({ ...values, username: "", password: "", role: "user" }),
  beforeSave: (values, editing) => {
    if (editing && !values.password) delete values.password;
    values.is_active = String(values.is_active) === "true";
    return values;
  },
  deleteLabel: (row) => String(row.username),
  deleteBody: (row) => ({ confirm_username: row.username }),
  extraAction: {
    label: "이력",
    render: (row, close) => (
      <Modal title={`${String(row.name)} (${String(row.username)}) 이력`} onClose={close}>
        <ActivityHistory accountId={row.id} />
      </Modal>
    ),
  },
};

export default function AccountsAdmin(props: AdminTabProps) {
  return <RecordsAdmin config={config} {...props} />;
}
