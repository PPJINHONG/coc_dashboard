import type { ChangeEvent } from "react";
import type { Field } from "../fields";

/** Field 정의에 맞는 입력칸(선택·여러 줄·숫자·글자)을 그립니다. */
export default function FieldInput({
  field,
  value,
  onChange,
  label,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
}) {
  const props = {
    "aria-label": label,
    value: value == null ? "" : String(value),
    onChange: (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const next = event.target.value;
      onChange(
        next === "" && field.nullable
          ? null
          : field.type === "number"
            ? next === ""
              ? ""
              : Number(next)
            : field.numberValue
              ? Number(next)
              : next,
      );
    },
  };
  if (field.type === "select")
    return (
      <select {...props}>
        {!field.nullable && (value == null || value === "") && (
          <option value="">선택하세요</option>
        )}
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  if (field.type === "textarea") return <textarea {...props} rows={2} />;
  return (
    <input
      {...props}
      type={field.type === "number" ? "number" : "text"}
      min={field.type === "number" ? 0 : undefined}
      max={field.max}
      step={field.step ?? "1"}
      placeholder={field.nullable ? "미입력" : undefined}
    />
  );
}
