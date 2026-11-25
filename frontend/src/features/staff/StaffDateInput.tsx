import { useId } from "react";

export const ONGOING = "재직중";
export const hasOngoing = (key: string) => key === "resignation_date" || key === "assignment_end_date";

export default function StaffDateInput({ fieldKey, label, value, onChange, required = false }: {
  fieldKey: string; label: string; value: string; onChange: (value: string) => void; required?: boolean;
}) {
  const id = useId();
  const ongoing = hasOngoing(fieldKey);
  return <div className="staff-date-field">
    <label htmlFor={id}>{label}{required && " *"}</label>
    <div className="staff-date-controls">
      {ongoing && <select id={id} aria-label={label + " 입력 방식"} value={value === ONGOING ? "ongoing" : "date"}
        onChange={(event) => onChange(event.target.value === "ongoing" ? ONGOING : "")}>
        <option value="ongoing">{ONGOING}</option><option value="date">날짜 선택</option>
      </select>}
      {value !== ONGOING && <input id={ongoing ? undefined : id} type="date" aria-label={label} required={required || ongoing}
        value={value} onChange={(event) => onChange(event.target.value)} />}
    </div>
  </div>;
}
