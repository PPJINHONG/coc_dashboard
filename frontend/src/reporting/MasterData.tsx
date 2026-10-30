import { useEffect, useState } from "react";
import ErrorMessage from "../components/ErrorMessage";
import * as api from "./api";
import type { Bootstrap, MasterKind } from "./api";
import { errorMessage, Modal, Panel } from "./components";
import { copyCommonRow } from "./copy";

const LABELS: Record<MasterKind, string> = {
  regions: "리전",
  services: "서비스",
  "staff-members": "인력",
};
export function MasterForm({
  kind,
  initial,
  copyMode = false,
  onClose,
  onSaved,
  onBusy,
}: {
  kind: MasterKind;
  initial?: Record<string, unknown>;
  copyMode?: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onBusy?: (busy: boolean) => void;
}) {
  const definitions =
    kind === "regions"
      ? [
          {
            key: "region_name",
            label: "리전 이름",
            placeholder: "KR신규센터",
            max: 80,
          },
          {
            key: "country_code",
            label: "국가 코드",
            placeholder: "KR",
            max: 10,
          },
        ]
      : kind === "services"
        ? [
            {
              key: "service_code",
              label: "서비스 코드",
              placeholder: "NEW-SERVICE",
              max: 40,
            },
            {
              key: "service_name",
              label: "서비스 이름",
              placeholder: "서비스 이름",
              max: 80,
            },
          ]
        : [
            { key: "staff_name", label: "이름", placeholder: "성명", max: 100 },
          ];
  const [form, setForm] = useState<Record<string, unknown>>(
    initial
      ? copyMode
        ? copyCommonRow(kind, initial)
        : { ...initial }
      : { country_code: "KR" },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);
  return (
    <Modal
      title={`${LABELS[kind]} 공통데이터 ${copyMode ? "복사" : initial ? "수정" : "등록"}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="master-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          const values = Object.fromEntries([
            ...definitions.map((d) => [
              d.key,
              typeof form[d.key] === "string"
                ? String(form[d.key]).trim()
                : form[d.key],
            ]),
          ]);
          try {
            await api.saveMaster(
              kind,
              values,
              initial && !copyMode
                ? ((initial.id ??
                    initial.service_code) as string | number)
                : undefined,
            );
            await onSaved();
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="account-fields" disabled={busy}>
          {definitions.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                value={String(form[field.key] ?? "")}
                placeholder={field.placeholder}
                maxLength={field.max}
                type="text"
                disabled={
                  Boolean(initial) &&
                  !copyMode &&
                  field.key === "service_code"
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                required
              />
            </label>
          ))}
          <p className="field-hint">
            공통데이터는 필요한 기능에서 같은 원본을 사용합니다. 연결된 데이터가
            있는 항목은 삭제할 수 없습니다.
          </p>
          <ErrorMessage message={error} />
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}

export default function MasterData({
  data,
  onSaved,
  onEditing,
  onBusy,
}: {
  data: Bootstrap;
  onEditing: (editing: boolean) => void;
  onBusy: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState<MasterKind>("regions");
  const [remove, setRemove] = useState<{
    kind: MasterKind;
    row: Record<string, unknown>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    kind: MasterKind;
    initial?: Record<string, unknown>;
    copyMode?: boolean;
  } | null>(null);
  useEffect(() => {
    onEditing(Boolean(dialog || remove));
    return () => onEditing(false);
  }, [dialog, remove, onEditing]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const collections: {
    kind: MasterKind;
    rows: Record<string, unknown>[];
    columns: [string, string][];
  }[] = [
    {
      kind: "regions",
      rows: data.regions as unknown as Record<string, unknown>[],
      columns: [
        ["region_name", "리전 이름"],
        ["country_code", "국가"],
      ],
    },
    {
      kind: "services",
      rows: data.services as unknown as Record<string, unknown>[],
      columns: [
        ["service_code", "서비스 코드"],
        ["service_name", "서비스 이름"],
      ],
    },
    {
      kind: "staff-members",
      rows: data.staff_members as unknown as Record<string, unknown>[],
      columns: [["staff_name", "이름"]],
    },
  ];
  return (
    <div className="report-sections">
      <header className="section-head">
        <div>
          <h1>공통데이터</h1>
          <p className="section-sub">
            리전·서비스·인력은 한 번 등록하고 필요한 기능에서 함께 사용합니다.
          </p>
        </div>
      </header>
      <nav className="db-feature-tabs" aria-label="공통데이터 종류">
        {(Object.entries(LABELS) as [MasterKind, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              className={`btn${kind === key ? " btn-primary" : ""}`}
              aria-pressed={kind === key}
              disabled={Boolean(dialog || remove) || busy}
              onClick={() => setKind(key)}
            >
              {label}
            </button>
          ),
        )}
      </nav>
      {collections
        .filter((collection) => collection.kind === kind)
        .map(({ kind, rows, columns }) => (
          <Panel
            key={kind}
            title={`${LABELS[kind]} 목록`}
            action={
              <button
                className="btn btn-sm"
                disabled={!data.can_manage || busy}
                onClick={() => setDialog({ kind })}
              >
                + {LABELS[kind]} 추가
              </button>
            }
          >
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    {columns.map(([key, label]) => (
                      <th key={key}>{label}</th>
                    ))}
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={String(
                        row.id ?? row.service_code,
                      )}
                    >
                      {columns.map(([key]) => (
                        <td key={key}>{String(row[key])}</td>
                      ))}
                      <td>
                        <button
                          className="btn btn-sm"
                          disabled={!data.can_manage || busy}
                          onClick={() => setDialog({ kind, initial: row })}
                        >
                          수정
                        </button>
                        <button
                          className="btn btn-sm"
                          disabled={!data.can_manage || busy}
                          onClick={() =>
                            setDialog({ kind, initial: row, copyMode: true })
                          }
                        >
                          행 복사
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={!data.can_manage || busy}
                          onClick={() => setRemove({ kind, row })}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      {remove && (
        <Modal
          title="공통데이터 삭제"
          onClose={() => {
            if (!busy) {
              setRemove(null);
              setError(null);
            }
          }}
        >
          <p>
            {String(
              remove.row.region_name ??
                remove.row.service_name ??
                remove.row.staff_name,
            )}{" "}
            항목을 삭제하시겠습니까? 연결된 데이터가 있으면 삭제할 수 없습니다.
          </p>
          <ErrorMessage message={error} />
          <div className="actions">
            <button
              className="btn"
              disabled={!data.can_manage || busy}
              onClick={() => setRemove(null)}
            >
              취소
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await api.deleteMaster(
                    remove.kind,
                    (remove.row.id ??
                      remove.row.service_code) as string | number,
                  );
                  await onSaved();
                  setRemove(null);
                } catch (err) {
                  setError(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "삭제 중…" : "삭제"}
            </button>
          </div>
        </Modal>
      )}
      {dialog && (
        <MasterForm
          {...dialog}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          onBusy={onBusy}
        />
      )}
    </div>
  );
}
