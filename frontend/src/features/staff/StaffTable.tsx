import { Fragment } from "react";
import type { Bootstrap, DataRow } from "../../shared/api/operations";
import Icon from "../../shared/components/Icon";
import { cell } from "../../shared/fields";
import { staffFields } from "./fields";
import type { Field } from "../../shared/fields";

const COUNTRIES: Record<string, string> = { KR: "내수", EU: "유럽", NA: "북미" };
const ROLE_ORDER = ["team_lead", "group_lead", "admin", "user"];
const ROLE_LABELS: Record<string, string> = { team_lead: "팀장", group_lead: "그룹장", admin: "관리자" };

/** 권역(KR → EU → NA) → 역할(팀장 → 그룹장 → 책임 → 팀원) → 이름 순으로 정렬합니다. */
export function sortStaff(rows: DataRow[]) {
  const country = (row: DataRow) => { const index = Object.keys(COUNTRIES).indexOf(String(row.country_code)); return index < 0 ? 9 : index; };
  const role = (row: DataRow) => { const index = ROLE_ORDER.indexOf(String(row.display_role ?? "user")); return index < 0 ? 3 : index; };
  const title = (row: DataRow) => row.job_title === "책임" ? 0 : 1;
  return [...rows].sort((a, b) => country(a) - country(b) || role(a) - role(b) || title(a) - title(b) || String(a.staff_name ?? "").localeCompare(String(b.staff_name ?? ""), "ko"));
}

/**
 * 운영 인력 조회 표. 권역마다 구분 행과 왼쪽 색 막대로 나누고, 팀장·그룹장은 역할 배지와 옅은 행 강조로 드러냅니다.
 * counts는 페이지와 관계없는 권역별 전체 인원(없으면 표에 넘긴 행으로 셉니다).
 */
export default function StaffTable({ rows, data, onEdit, columns: selectedColumns, counts }: { rows: DataRow[]; data: Bootstrap; onEdit?: (row: DataRow) => void; columns?: Field[]; counts?: Record<string, number> }) {
  const columns = selectedColumns ?? staffFields(data, rows.some((row) => Object.hasOwn(row, "grade")));
  const span = columns.length + 1 + (onEdit ? 1 : 0);
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
            const roleKey = String(row.display_role ?? "user");
            const role = roleKey.replaceAll("_", "-");
            const group = rows.filter((item) => item.country_code === country);
            const leads = (key: string) => group.filter((item) => item.display_role === key).length;
            return (
              <Fragment key={row.id ?? index}>
                {(index === 0 || rows[index - 1].country_code !== country) && <tr className={`staff-group-row staff-country-${tone}`}>
                  <th scope="rowgroup" colSpan={span}>
                    <span className="staff-country-badge"><i aria-hidden="true" />{country || "—"}</span>
                    <strong>{COUNTRIES[country] ?? "권역 미지정"}</strong>
                    <span>{counts?.[country] ?? group.length}명</span>
                    {leads("team_lead") > 0 && <span>팀장 {leads("team_lead")}</span>}
                    {leads("group_lead") > 0 && <span>그룹장 {leads("group_lead")}</span>}
                  </th>
                </tr>}
                <tr className={`staff-country-${tone} staff-role-${role}`}>
                  <th scope="row" className="staff-row-number">{String(index + 1).padStart(2, "0")}</th>
                  {columns.map((field) => (
                    <td key={field.key} className={`staff-cell-${field.key}`}>
                      {field.key === "country_code" ? (
                        <span className="staff-country-badge"><i aria-hidden="true" />{country || "—"}</span>
                      ) : field.key === "staff" ? (
                        <span className="staff-person">
                          <span className="staff-avatar" aria-hidden="true"><Icon name="person" size={18} /></span>
                          <span className="staff-person-name">{cell(row, field)}
                            {row.is_site_representative === true && <span className="staff-site-rep" title={`${country} 권역 현장대리인`}><Icon name="flag" size={11} />현장대리인</span>}
                          </span>
                        </span>
                      ) : field.key === "work_status" ? (
                        <span className={`staff-status staff-status-${String(row.work_status ?? "")}`}><i aria-hidden="true" />{String(row.current_status ?? cell(row, field))}</span>
                      ) : field.key === "job_title" ? (
                        <span className="staff-title-labels">
                          {ROLE_LABELS[roleKey] ? <span className={`staff-role-pill staff-role-pill-${role}`}>{["team-lead", "group-lead"].includes(role) && <Icon name={role === "team-lead" ? "shield" : "users"} size={13} />}{ROLE_LABELS[roleKey]}</span>
                            : <span className="staff-job-title">{cell(row, field)}</span>}
                          {ROLE_LABELS[roleKey] && Boolean(row.job_title) && row.job_title !== ROLE_LABELS[roleKey] && <span className="staff-job-title">{String(row.job_title)}</span>}
                        </span>
                      ) : cell(row, field)}
                    </td>
                  ))}
                  {onEdit && <td><div className="staff-row-actions">{row.can_edit === true && <button className="btn btn-sm" onClick={() => onEdit(row)} aria-label={`${row.staff_name} 정보 수정`}>정보 수정</button>}</div></td>}
                </tr>
              </Fragment>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={span} className="staff-empty">표시할 운영 인력이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
