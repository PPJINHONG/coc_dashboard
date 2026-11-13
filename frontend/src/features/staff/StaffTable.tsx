import type { Bootstrap, DataRow } from "../../shared/api/operations";
import Icon from "../../shared/components/Icon";
import { cell } from "../../shared/fields";
import { staffFields } from "./fields";
import type { Field } from "../../shared/fields";

/** 운영 인력 조회 표: 국가 배지·사람 아이콘·직책 표시. */
export default function StaffTable({ rows, data, onEdit, columns: selectedColumns }: { rows: DataRow[]; data: Bootstrap; onEdit?: (row: DataRow) => void; columns?: Field[] }) {
  const columns = selectedColumns ?? staffFields(data, rows.some((row) => Object.hasOwn(row, "grade")));
  return (
    <div className="staff-table-scroll" tabIndex={0} role="region" aria-label="운영 인력 목록">
      <table className="staff-table">
        <thead>
          <tr>
            <th scope="col" className="staff-row-number">No.</th>
            {columns.map((field) => <th scope="col" key={field.key}>{field.label}</th>)}
            {onEdit && <th scope="col">관리</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const country = String(row.country_code ?? "");
            const tone = ["KR", "EU", "NA"].includes(country) ? country.toLowerCase() : "unknown";
            return (
              <tr key={row.id ?? index} className={`staff-country-${tone}`}>
                <th scope="row" className="staff-row-number">{String(index + 1).padStart(2, "0")}</th>
                {columns.map((field) => (
                  <td key={field.key} className={`staff-cell-${field.key}`}>
                    {field.key === "country_code" ? (
                      <span className="staff-country-badge"><i aria-hidden="true" />{country || "—"}</span>
                    ) : field.key === "staff" ? (
                      <span className="staff-person">
                        <span className="staff-avatar" aria-hidden="true"><Icon name="person" size={18} /></span>
                        <span>{cell(row, field)}</span>
                      </span>
                    ) : field.key === "job_title" ? (
                      <span className="staff-job-title">{cell(row, field)}</span>
                    ) : cell(row, field)}
                  </td>
                ))}
                {onEdit && <td>{row.can_edit === true && <button className="btn btn-sm" onClick={() => onEdit(row)} aria-label={`${row.staff_name} 정보 수정`}>정보 수정</button>}</td>}
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={columns.length + 1 + (onEdit ? 1 : 0)} className="staff-empty">표시할 운영 인력이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
