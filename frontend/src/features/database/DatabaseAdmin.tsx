import { useCallback, useState } from "react";
import type { Bootstrap, Snapshot } from "../../shared/api/operations";
import AdminLogin from "../../shared/auth/AdminLogin";
import { useAuth } from "../../shared/auth/AuthContext";
import Panel from "../../shared/components/Panel";
import type { FeatureDefinition } from "../../shared/feature";
import CommonData from "./CommonData";
import RawTables from "./RawTables";


interface AdminProps {
  data: Bootstrap;
  snapshot: Snapshot;
  /** 기능별 설정 하위 탭은 각 기능 feature.tsx의 admin에서 모읍니다. */
  features: FeatureDefinition[];
  onChanged: () => Promise<void>;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
}
export default function DatabaseAdmin(props: AdminProps) {
  const { user } = useAuth();
  const tabs = props.features.flatMap((feature) => feature.admin ?? []);
  const [mode, setMode] = useState<"common" | "features" | "raw">("features");
  const [feature, setFeature] = useState(tabs[0].id);
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const onEditing = useCallback(
    (value: boolean) => {
      setEditing(value);
      props.onEditing(value);
    },
    [props.onEditing],
  );
  const onBusy = useCallback(
    (value: boolean) => {
      setBusy(value);
      props.onBusy(value);
    },
    [props.onBusy],
  );
  if (!user?.is_staff)
    return (
      <Panel title="관리자 인증">
        <AdminLogin />
      </Panel>
    );
  const current = tabs.find((tab) => tab.id === feature) ?? tabs[0];
  return (
    <div className="db-workspace">
      <header className="db-page-head">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>DB 관리</h1>
          <p className="muted">
            공통데이터와 기능별 운영 데이터를 한곳에서 관리하세요.
          </p>
        </div>
        <span className="report-badge">관리자 전용</span>
      </header>
      <div className="db-admin-layout">
        <div className="db-admin-navigation">
          <nav className="db-primary-tabs" aria-label="DB 관리 구분">
            {(
              [
                ["common", "공통데이터"],
                ["features", "기능별 설정"],
                ["raw", "DB 원본"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={mode === key}
                disabled={editing || busy}
                onClick={() => setMode(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {editing && (
            <span className="db-editing-hint">
              편집을 저장하거나 취소한 뒤 이동하세요.
            </span>
          )}
        </div>
        <div className="db-admin-content">
          {mode === "raw" ? (
            <RawTables />
          ) : mode === "common" ? (
            <CommonData
              data={props.data}
              onSaved={props.onChanged}
              onEditing={onEditing}
              onBusy={onBusy}
            />
          ) : (
            <>
              <nav className="db-feature-tabs" aria-label="기능별 DB 설정">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`btn${feature === tab.id ? " btn-primary" : ""}`}
                    disabled={editing || busy}
                    aria-pressed={feature === tab.id}
                    onClick={() => setFeature(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              <current.Editor
                key={current.id}
                data={props.data}
                snapshot={props.snapshot}
                onChanged={props.onChanged}
                onEditing={onEditing}
                onBusy={onBusy}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
