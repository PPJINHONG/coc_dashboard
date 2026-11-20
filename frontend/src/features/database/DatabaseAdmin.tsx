import AdminLogin from "../../shared/auth/AdminLogin";
import { useAuth } from "../../shared/auth/AuthContext";
import Panel from "../../shared/components/Panel";
import RawTables from "./RawTables";

export default function DatabaseAdmin() {
  const { user } = useAuth();

  if (!user?.is_staff)
    return (
      <Panel title="관리자 인증">
        <AdminLogin />
      </Panel>
    );

  return (
    <div className="db-workspace">
      <header className="db-page-head">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>DB 관리</h1>
          <p className="muted">등록된 원본 테이블의 구조와 행을 조회하세요.</p>
        </div>
        <span className="report-badge">관리자 전용 · 읽기 전용</span>
      </header>
      <div className="db-admin-content">
        <RawTables />
      </div>
    </div>
  );
}
