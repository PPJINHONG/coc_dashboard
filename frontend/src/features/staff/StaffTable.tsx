import { Fragment } from "react";
import type { Bootstrap, DataRow } from "../../shared/api/operations";
import { cell } from "../../shared/fields";
import { staffFields } from "./fields";
import type { Field } from "../../shared/fields";

const COUNTRIES: Record<string, string> = { KR: "내수", EU: "유럽", NA: "북미" };
const ROLE_ORDER = ["team_lead", "group_lead", "admin", "user"];

/** 권역(KR → EU → NA) → 역할(팀장 → 그룹장 → 책임 → 팀원) → 이름 순으로 정렬합니다. */
export function sortStaff(rows: DataRow[]) {
  const country = (row: DataRow) => { const index = Object.keys(COUNTRIES).indexOf(String(row.country_code)); return index < 0 ? 9 : index; };
  const role = (row: DataRow) => { const index = ROLE_ORDER.indexOf(String(row.display_role ?? "user")); return index < 0 ? 3 : index; };
  const title = (row: DataRow) => row.job_title === "책임" ? 0 : 1;
  return [...rows].sort((a, b) => country(a) - country(b) || role(a) - role(b) || title(a) - title(b) || String(a.staff_name ?? "").localeCompare(String(b.staff_name ?? ""), "ko"));
}

type TableProps = {
  rows: DataRow[];
  data: Bootstrap;
  onEdit?: (row: DataRow) => void;
  columns?: Field[];
  counts?: Record<string, number>;
  widths?: Record<string, number>;
  onWidth?: (key: string, width: number) => void;
};

export default function StaffTable({ rows, onEdit, columns = staffFields(), counts, widths = {}, onWidth }: TableProps) {
  const fixedWidth = Boolean(onWidth) || columns.some((field) => widths[field.key]);
  const widthOf = (key: string) => widths[key] ?? 220;
  return (
    <div className="staff-table-scroll" tabIndex={0} role="region" aria-label="운영 인력 목록">
      <table className="staff-table staff-directory-table" style={fixedWidth ? { width: columns.reduce((sum, field) => sum + widthOf(field.key), 0) } : undefined}>
        <colgroup>{columns.map((field) => <col key={field.key} style={fixedWidth ? { width: widthOf(field.key) } : undefined} />)}</colgroup>
        <thead><tr>{columns.map((field) => <th scope="col" key={field.key}>
          {field.label}
          {onWidth && <label className="staff-width-control">
            <input aria-label={field.label + " 열 너비"} type="range" min={120} max={720} step={10} value={widthOf(field.key)} onChange={(event) => onWidth(field.key, Number(event.target.value))} />
            <span>{widthOf(field.key)} px</span>
          </label>}
        </th>)}</tr></thead>
        <tbody>{rows.map((row, index) => {
          const country = String(row.country_code ?? "");
          return <Fragment key={row.id ?? index}>
            {(index === 0 || rows[index - 1].country_code !== country) && <tr className={`staff-group-row staff-country-${country.toLowerCase()}`}>
              <th scope="rowgroup" colSpan={columns.length}><strong>{country} · {COUNTRIES[country]}</strong><span>{counts?.[country] ?? rows.filter((item) => item.country_code === country).length}명</span></th>
            </tr>}
            <tr className={`staff-country-${country.toLowerCase()}`}>
              {columns.map((field) => <td key={field.key}>
                {field.key === "staff_name" && onEdit && row.can_edit === true
                  ? <button type="button" className="btn btn-sm" aria-label={row.staff_name + " 정보 수정"} onClick={() => onEdit(row)}>{cell(row, field)} · 수정</button>
                  : field.key === "country_code"
                    ? <span className="staff-country-badge"><i aria-hidden="true" />{country}</span>
                    : cell(row, field)}
              </td>)}
            </tr>
          </Fragment>;
        })}
        {!rows.length && <tr><td colSpan={columns.length} className="staff-empty">표시할 운영 인력이 없습니다.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
