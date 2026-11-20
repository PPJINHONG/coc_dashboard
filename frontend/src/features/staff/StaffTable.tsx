import type { Bootstrap, DataRow } from "../../shared/api/operations";
import Icon from "../../shared/components/Icon";
import { cell } from "../../shared/fields";
import { staffFields } from "./fields";
import type { Field } from "../../shared/fields";

/** 운영 인력 조회 표: 국가 배지·사람 아이콘·직책 표시. */
export default function StaffTable({ rows, data, onEdit, onRepresentative, columns: selectedColumns }: { rows: DataRow[]; data: Bootstrap; onEdit?: (row: DataRow) => void; onRepresentative?: (row: DataRow) => void; columns?: Field[] }) {
  const columns = selectedColumns ?? staffFields(data, rows.some((row) => Object.hasOwn(row, "grade")));
  return (
    <div className="staff-table-scroll" tabIndex={0} role="region" aria-label="운영 인력 목록">
      <table className="staff-table">
        <thead>
          <tr>
            <th scope="col" className="staff-row-number">No.</th>
            {columns.map((field) => <th scope="col" key={field.key}>{field.label}</th>)}
            {(onEdit || onRepresentative) && <th scope="col">관리</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const country = String(row.country_code ?? "");
            const tone = ["KR", "EU", "NA"].includes(country) ? country.toLowerCase() : "unknown";
            const role = String(row.display_role ?? "user").replaceAll("_", "-");
            return (
              <tr key={row.id ?? index} className={`staff-country-${tone} staff-role-${role}`}>
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
                    ) : field.key === "work_status" ? (
                      <span className={`staff-status staff-status-${String(row.work_status ?? "")}`}><i aria-hidden="true" />{String(row.current_status ?? cell(row, field))}</span>
                    ) : field.key === "job_title" ? (
                      <span className="staff-title-labels"><span className="staff-job-title">{cell(row, field)}</span>
                        {row.display_role === "observer" && row.job_title !== "옵저버" && <span className="staff-job-title">옵저버</span>}
                        {row.is_site_representative === true && <span className="staff-representative-badge">현장대리인</span>}
                      </span>
                    ) : cell(row, field)}
                  </td>
                ))}
                {(onEdit || onRepresentative) && <td><div className="staff-row-actions">{onEdit && row.can_edit === true && <button className="btn btn-sm" onClick={() => onEdit(row)} aria-label={`${row.staff_name} 정보 수정`}>정보 수정</button>}
                  {onRepresentative && row.can_set_site_representative === true && <button className="btn btn-sm" onClick={() => onRepresentative(row)} aria-label={`${row.staff_name} 현장대리인 ${row.is_site_representative ? "해제" : "지정"}`}>{row.is_site_representative ? "현장대리인 해제" : "현장대리인 지정"}</button>}
                </div></td>}
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={columns.length + 1 + (onEdit || onRepresentative ? 1 : 0)} className="staff-empty">표시할 운영 인력이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
