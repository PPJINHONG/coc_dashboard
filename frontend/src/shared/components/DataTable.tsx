import type { ReactNode } from "react";
import type { DataRow } from "../api/operations";
import { cell, type Field } from "../fields";

/** 표 끝에 붙이는 계산 열(예: 운영 작업의 미완료·완료율). 숫자처럼 오른쪽 정렬합니다. */
export interface ExtraColumn {
  label: string;
  value: (row: DataRow) => ReactNode;
}

/** 기능 공통 데이터 표: 행 번호·셀 경계·상태 배지·빈 목록 안내를 같은 모양으로 그립니다. */
export default function DataTable({
  columns,
  rows,
  extraColumns = [],
  footer,
}: {
  columns: Field[];
  rows: DataRow[];
  extraColumns?: ExtraColumn[];
  /** 행이 있을 때 표 아래에 붙일 <tfoot> (예: 인프라 수량 합계) */
  footer?: (rows: DataRow[], columns: Field[]) => ReactNode;
}) {
  return (
    <div className="report-table-scroll">
      <table className="report-table">
        <thead>
          <tr>
            <th className="row-number" scope="col">
              #
            </th>
            {columns.map((field) => (
              <th
                key={field.key}
                scope="col"
                className={field.type === "number" ? "numeric" : ""}
              >
                {field.label}
              </th>
            ))}
            {extraColumns.map((column) => (
              <th key={column.label} className="numeric">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              <th className="row-number" scope="row">
                {index + 1}
              </th>
              {columns.map((field) => (
                <td
                  key={field.key}
                  className={
                    field.type === "number"
                      ? "numeric"
                      : field.type === "textarea"
                        ? "text-cell"
                        : ""
                  }
                >
                  {field.key === "status" ? (
                    <span
                      className={`report-badge status-${String(row.status)}`}
                    >
                      {cell(row, field)}
                    </span>
                  ) : (
                    cell(row, field)
                  )}
                </td>
              ))}
              {extraColumns.map((column) => (
                <td key={column.label} className="numeric">
                  {column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {!rows.length && (
          <tbody>
            <tr>
              <td
                colSpan={columns.length + extraColumns.length + 1}
                className="report-empty"
              >
                등록된 데이터가 없습니다.
              </td>
            </tr>
          </tbody>
        )}
        {rows.length > 0 && footer?.(rows, columns)}
      </table>
    </div>
  );
}
