import { useEffect, useMemo, useState, type ReactNode } from "react";
import { saveRows, sectionRows, type Bootstrap, type DataRow } from "../api/operations";
import ErrorMessage from "../components/ErrorMessage";
import FieldInput from "../components/FieldInput";
import Panel from "../components/Panel";
import { errorMessage } from "../errors";
import type { AdminTabProps } from "../feature";
import { copyRow, emptyRow, exportCsv } from "../fields";
import SectionFilters, { useSectionFilters } from "./SectionFilters";
import type { SectionConfig } from "./types";

interface Props {
  config: SectionConfig;
  rows: DataRow[];
  data: Bootstrap;
  onSave: (rows: DataRow[]) => Promise<void>;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
  onRefresh: () => void;
  /** 편집 전 조회 본문을 직접 그릴 때. 없으면 config.Table을 패널에 넣습니다. */
  renderView?: (rows: DataRow[]) => ReactNode;
  /** 처음부터 편집 상태로 엽니다(기능 탭의 바로 편집). */
  initialEditing?: boolean;
  /** 편집을 취소하거나 저장을 마쳤을 때 호출합니다. 넘기면 조회 화면 대신 호출한 쪽으로 돌아갑니다. */
  onClose?: () => void;
}

/** DB 관리 > 기능별 설정의 현재값 편집 화면. 편집 초안을 만든 뒤 저장할 때 전체 행을 보냅니다. */
export default function SectionEditor({
  config,
  rows,
  data,
  onSave,
  onEditing,
  onBusy,
  onRefresh,
  renderView,
  initialEditing = false,
  onClose,
}: Props) {
  const [editing, setEditing] = useState(initialEditing);
  const [draft, setDraft] = useState<DataRow[]>(() => structuredClone(rows));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columns = useMemo(() => config.fields(data), [config, data]);
  const filters = useSectionFilters(config, columns, rows);
  const { filtered } = filters;
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(rows);
  const { Summary, Table } = config;
  useEffect(() => {
    onEditing(dirty);
    return () => onEditing(false);
  }, [dirty, onEditing]);

  function update(index: number, key: string, value: unknown) {
    setDraft((current) =>
      current.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: value,
              ...(config.onFieldChange?.(key, value) ?? {}),
            }
          : row,
      ),
    );
  }
  function duplicate(index: number) {
    setDraft((current) => [
      ...current.slice(0, index + 1),
      copyRow(columns, current[index], config.copyReset),
      ...current.slice(index + 1),
    ]);
  }
  function remove(index: number) {
    setDraft((current) => current.filter((_, i) => i !== index));
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
      onEditing(false);
      onClose?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  const editActions = (
    <div className="actions">
      <button
        className="btn"
        disabled={busy}
        onClick={() => {
          setDraft(structuredClone(rows));
          setEditing(false);
          setError(null);
          onClose?.();
        }}
      >
        취소
      </button>
      <button
        className="btn btn-primary"
        disabled={busy || !dirty}
        onClick={save}
      >
        {busy ? "저장 중…" : "변경사항 저장"}
      </button>
    </div>
  );
  const rowButtons = (index: number) => (
    <>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => duplicate(index)}
      >
        행 복사
      </button>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => remove(index)}
      >
        행 삭제
      </button>
    </>
  );
  return (
    <div className="report-sections">
      <header className="section-head">
        <div>
          <h1>{config.label}</h1>
          <p className="section-sub">
            현재 데이터 ·{" "}
            {editing
              ? "편집 후 저장을 눌러 반영하세요."
              : "편집 버튼을 누르면 데이터를 입력·수정할 수 있습니다."}
          </p>
        </div>
        {editing ? (
          editActions
        ) : (
          <div className="actions">
            <button
              className="btn"
              onClick={() => exportCsv(config.key, columns, filtered)}
            >
              CSV 내보내기
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setDraft(structuredClone(rows));
                setEditing(true);
                setError(null);
              }}
            >
              편집
            </button>
          </div>
        )}
      </header>
      <ErrorMessage message={error} />
      {error && (
        <button className="btn btn-sm" onClick={onRefresh}>
          최신 데이터 다시 불러오기
        </button>
      )}
      {!editing && (
        <SectionFilters
          config={config}
          columns={columns}
          filters={filters}
          countText={<>{filtered.length}개 항목</>}
        />
      )}
      {Summary && !editing && <Summary rows={filtered} />}
      {editing ? (
        <Panel
          title={`${config.label} 편집`}
          subtitle={config.editorHint}
          action={
            <div className="actions">
              <button
                className="btn btn-sm"
                disabled={busy}
                onClick={() =>
                  setDraft((current) => [...current, emptyRow(columns)])
                }
              >
                {config.addLabel ?? "+ 행 추가"}
              </button>
            </div>
          }
        >
          <fieldset
            className="report-editor-fieldset"
            disabled={busy}
            aria-busy={busy}
          >
            {config.editLayout === "cards" ? (
              <div className="issue-edit-list">
                {draft.map((row, index) => (
                  <article
                    className="issue-edit-card"
                    key={row.id ?? `new-${index}`}
                  >
                    <header>
                      <h3>
                        {row.id
                          ? `이슈 #${String(row.id)}`
                          : `새 이슈 ${index + 1}`}
                      </h3>
                      {rowButtons(index)}
                    </header>
                    <div className="issue-edit-fields">
                      {columns.map((field) => (
                        <label
                          key={field.key}
                          className={field.type === "textarea" ? "wide" : ""}
                        >
                          <span>{field.label}</span>
                          <FieldInput
                            field={field}
                            value={row[field.key]}
                            onChange={(value) =>
                              update(index, field.key, value)
                            }
                            label={`${index + 1}행 ${field.label}`}
                          />
                        </label>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="report-table-scroll">
                <table className="report-table report-edit-table">
                  <thead>
                    <tr>
                      <th>번호</th>
                      {columns.map((field) => (
                        <th key={field.key}>{field.label}</th>
                      ))}
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.map((row, index) => (
                      <tr key={row.id ?? `new-${index}`}>
                        <td>{index + 1}</td>
                        {columns.map((field) => (
                          <td key={field.key}>
                            <FieldInput
                              field={field}
                              value={row[field.key]}
                              onChange={(value) =>
                                update(index, field.key, value)
                              }
                              label={`${index + 1}행 ${field.label}`}
                            />
                          </td>
                        ))}
                        <td>{rowButtons(index)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!draft.length && (
              <p className="report-empty">
                행 추가 버튼으로 입력을 시작하세요.
              </p>
            )}
          </fieldset>
          <div className="report-editor-foot">
            <span className="muted">
              {draft.length}개 항목 · 최신값으로 저장됩니다.
            </span>
            {editActions}
          </div>
        </Panel>
      ) : renderView ? (
        renderView(filtered)
      ) : (
        <Panel
          title={`${config.label} 상세`}
          subtitle="리포트와 동일한 DB 데이터를 사용합니다."
        >
          {Table && <Table rows={filtered} data={data} />}
        </Panel>
      )}
    </div>
  );
}

/** 기능 feature.tsx의 admin 탭에서 바로 쓰는 편집 화면. 저장 후 최신 데이터를 다시 불러옵니다. */
export function SectionAdmin({
  config,
  renderView,
  data,
  snapshot,
  onChanged,
  onEditing,
  onBusy,
}: AdminTabProps & {
  config: SectionConfig;
  renderView?: (rows: DataRow[]) => ReactNode;
}) {
  return (
    <SectionEditor
      config={config}
      rows={sectionRows(snapshot, config.key)}
      data={data}
      onSave={async (rows) => {
        await saveRows(snapshot.revision, config.key, rows, snapshot.month);
        await onChanged();
      }}
      onEditing={onEditing}
      onBusy={onBusy}
      onRefresh={() => {
        void onChanged();
      }}
      renderView={renderView}
    />
  );
}
