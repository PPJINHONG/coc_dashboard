import { Fragment, useEffect, useState } from "react";
import type { Bootstrap, DataRow } from "../../shared/api/operations";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { RESOURCE_SERVICES, type ResourceInput } from "./api";

type ResourceDraft = Omit<ResourceInput, "host_count"> & {
  host_count: number | "";
};

function initialValues(row: DataRow | null, data: Bootstrap): ResourceDraft {
  return {
    region: Number(row?.region ?? data.regions[0]?.id ?? 0),
    service: row?.service === "CCS" ? "CCS" : "HCLOUD",
    host_count: row?.host_count == null ? 0 : Number(row.host_count),
    vm_count: row?.vm_count == null ? null : Number(row.vm_count),
    compute_rack_count:
      row?.compute_rack_count == null ? null : Number(row.compute_rack_count),
    storage_count:
      row?.storage_count == null ? null : Number(row.storage_count),
    remarks: String(row?.remarks ?? ""),
  };
}

export default function ResourceForm({
  row,
  data,
  month,
  busy,
  error,
  onSubmit,
  onCancel,
  onDirty,
}: {
  row: DataRow | null;
  data: Bootstrap;
  month: string;
  busy: boolean;
  error: string;
  onSubmit: (values: ResourceInput) => Promise<void>;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [initial] = useState(() => initialValues(row, data));
  const [values, setValues] = useState<ResourceDraft>(initial);
  const [validation, setValidation] = useState("");
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);

  function update<K extends keyof ResourceDraft>(
    key: K,
    value: ResourceDraft[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidation("");
  }

  async function submit() {
    const quantities = [
      values.host_count,
      values.vm_count,
      values.compute_rack_count,
      values.storage_count,
    ].filter((value) => value !== null && value !== "") as number[];
    if (!values.region) {
      setValidation("리전을 선택해 주세요.");
      return;
    }
    if (
      values.host_count === "" ||
      quantities.some((value) => !Number.isInteger(value) || value < 0)
    ) {
      setValidation("수량은 0 이상의 정수로 입력해 주세요.");
      return;
    }
    await onSubmit({ ...values, host_count: values.host_count });
  }

  const nullableNumber = (
    key: "vm_count" | "compute_rack_count" | "storage_count",
    label: string,
  ) => (
    <td className="resource-edit-number">
      <input
        aria-label={label}
        title={label}
        disabled={busy}
        type="number"
        min={0}
        step={1}
        value={values[key] ?? ""}
        placeholder="미입력"
        onChange={(event) =>
          update(key, event.target.value === "" ? null : Number(event.target.value))
        }
      />
    </td>
  );

  const message = validation || error;
  return (
    <Fragment>
      <tr className="resource-edit-row">
        <th
          className="grid-gutter"
          scope="row"
          title={`${month} 기준 ${row ? "자원 수정" : "새 자원 추가"}`}
        >
          {row ? "수정" : "신규"}
        </th>
        <td>
          <select
            aria-label="리전"
            disabled={busy}
            value={values.region || ""}
            onChange={(event) => update("region", Number(event.target.value))}
          >
            {!values.region && <option value="">선택</option>}
            {data.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.region_name} ({region.country_code})
              </option>
            ))}
          </select>
        </td>
        <td>
          <select
            aria-label="서비스"
            title="서비스"
            disabled={busy}
            value={values.service}
            onChange={(event) => update("service", event.target.value as ResourceInput["service"])}
          >
            {RESOURCE_SERVICES.map((service) => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
        </td>
        <td className="resource-edit-number">
          <input
            aria-label="Host"
            title="Host"
            disabled={busy}
            type="number"
            min={0}
            step={1}
            value={values.host_count}
            onChange={(event) =>
              update(
                "host_count",
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
          />
        </td>
        {nullableNumber("vm_count", "VM")}
        {nullableNumber("compute_rack_count", "Compute Rack")}
        {nullableNumber("storage_count", "Storage Rack")}
        <td>
          <input
            aria-label="비고"
            disabled={busy}
            value={values.remarks}
            placeholder="비고"
            onChange={(event) => update("remarks", event.target.value)}
          />
        </td>
        <td className="resource-date">{row ? "수정 중" : "저장 전"}</td>
        <td className="resource-action resource-edit-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={
              busy ||
              (Boolean(row) && !dirty) ||
              !values.region
            }
            onClick={() => void submit()}
          >
            {busy ? "저장 중…" : "저장"}
          </button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onCancel}>
            취소
          </button>
        </td>
      </tr>
      {message && (
        <tr className="resource-edit-error">
          <td colSpan={10}>
            <ErrorMessage message={message} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
