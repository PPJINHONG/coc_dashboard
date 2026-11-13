import { useMemo, useState } from "react";
import { sectionRows, type DataRow } from "../../shared/api/operations";
import type { FeaturePageProps } from "../../shared/feature";
import SectionEditor from "../../shared/sections/SectionEditor";
import SectionPage from "../../shared/sections/SectionPage";
import type { SectionConfig } from "../../shared/sections/types";
import { saveStaff } from "./api";
import { staffEditFields } from "./fields";

const EDIT_KEYS = ["id", "country_code", "staff_name", "job_title", "company_name", "job_description",
  "work_location", "pc_ip", "autoever_account", "z_account"];

/**
 * 운영 인력 탭. 관리자·팀장은 모든 국가, 그룹장은 관리 국가의 행을 이 화면에서 바로 편집합니다.
 * 편집할 수 있는 행은 서버가 내려 준 can_edit, 국가 선택지는 로그인 사용자의 staff_edit_countries로 정합니다.
 */
export default function StaffPage({
  section,
  data,
  snapshot,
  user,
  refresh,
  setDirty,
  setBusy,
}: FeaturePageProps & { section: SectionConfig }) {
  const [editing, setEditing] = useState(false);
  const countries = user?.staff_edit_countries ?? [];
  const rows = sectionRows(snapshot, "staff");
  const editableRows = useMemo(
    () =>
      rows
        .filter((row) => row.can_edit)
        .map((row) => Object.fromEntries(EDIT_KEYS.map((key) => [key, row[key] ?? ""])) as DataRow),
    [rows],
  );
  const editConfig = useMemo<SectionConfig>(
    () => ({
      ...section,
      label: "운영 인력",
      fields: () => staffEditFields(countries),
      Table: undefined,
      Summary: undefined,
      copyReset: ["staff_name", "pc_ip", "autoever_account", "z_account"],
      editorHint:
        countries.length === 3
          ? "모든 국가의 운영 인력을 편집합니다. 행을 지우면 저장할 때 삭제됩니다."
          : `${countries.join("·")} 운영 인력만 편집할 수 있습니다. 다른 국가 인력은 바뀌지 않습니다.`,
    }),
    [section, countries],
  );
  if (editing && countries.length) {
    return (
      <SectionEditor
        config={editConfig}
        rows={editableRows}
        data={data}
        initialEditing
        onClose={() => setEditing(false)}
        onEditing={setDirty}
        onBusy={setBusy}
        onRefresh={() => void refresh()}
        onSave={async (draft) => {
          await saveStaff(snapshot.revision, draft);
          await refresh();
        }}
      />
    );
  }
  return (
    <SectionPage
      config={section}
      rows={rows}
      data={data}
      subtitle={
        countries.length === 3
          ? "편집 버튼으로 모든 국가의 운영 인력을 바로 수정할 수 있습니다."
          : countries.length
            ? `${countries.join("·")} 그룹장 권한으로 해당 국가 운영 인력을 수정할 수 있습니다.`
            : undefined
      }
      actions={
        countries.length > 0 && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            편집
          </button>
        )
      }
    />
  );
}
