import { useEffect, useState } from "react";
import Panel from "../../shared/components/Panel";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { staffTrend, type StaffTrend } from "./api";

export default function StaffTrends({ month, revision }: { month: string; revision: number }) {
  const [country, setCountry] = useState("");
  const [company, setCompany] = useState("");
  const [result, setResult] = useState<StaffTrend | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { let active = true; setLoading(true); setError(""); staffTrend(month, country, company).then((value) => { if (active) setResult(value); }).catch((cause) => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [month, country, company, revision]);
  const maxMoves = Math.max(1, ...(result?.months.flatMap((item) => [item.entries, item.exits]) ?? []));
  const maxPeople = Math.max(1, ...(result?.months.map((item) => item.headcount) ?? []));
  const points = result?.months.map((item, index) => `${48 + index * 72},${175 - item.headcount / maxPeople * 140}`).join(" ") ?? "";
  return <div className="report-sections"><header className="section-head"><div><h1>인력 추이</h1><p className="section-sub">최근 12개월 업무 투입·회사 퇴사 및 운영 인원</p></div></header>
    <div className="report-filters"><label>권역<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="">전체 권역</option>{["KR", "EU", "NA"].map((value) => <option key={value}>{value}</option>)}</select></label><label>소속사<select value={company} onChange={(event) => setCompany(event.target.value)}><option value="">전체 소속사</option>{result?.companies.map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <ErrorMessage message={error} />{loading && <p role="status">추이를 계산하고 있습니다…</p>}
    {result && !loading && <><p className="staff-notice">{result.grouping} · 투입일 미등록 {result.missing_dates}명은 집계에서 제외됩니다. 현재 월은 오늘까지 집계하며 회사 퇴사일의 종료 시점에 인원에서 제외합니다.</p>
      <Panel title="월별 운영 인원"><div className="staff-trend-chart"><svg viewBox="0 0 900 235" role="img" aria-label="월별 운영 인원 추이. 아래 표에서 상세 수치를 확인할 수 있습니다."><line x1="24" y1="176" x2="870" y2="176" stroke="#cbdbea" /><polyline points={points} fill="none" stroke="#356eb0" strokeWidth="3" />{result.months.map((item, index) => <g key={item.month}><circle cx={48 + index * 72} cy={175 - item.headcount / maxPeople * 140} r="4" fill="#356eb0" /><text x={48 + index * 72} y={163 - item.headcount / maxPeople * 140} textAnchor="middle">{item.headcount}명</text><text x={48 + index * 72} y="206" textAnchor="middle">{item.month.slice(2)}</text></g>)}</svg></div></Panel>
      <Panel title="월별 투입·퇴사"><div className="staff-trend-bars">{result.months.map((item) => <div className="staff-trend-month" key={item.month}><div className="staff-trend-bar-pair"><div style={{ height: `${item.entries / maxMoves * 110}px` }} title={`투입 ${item.entries}명`} /><div className="staff-trend-exits" style={{ height: `${item.exits / maxMoves * 110}px` }} title={`퇴사 ${item.exits}명`} /></div><span>{item.month.slice(2)}</span></div>)}</div><p className="staff-trend-legend">진한 파랑: 업무 투입 · 옅은 파랑: 회사 퇴사</p></Panel>
      <Panel title="월별 상세"><div className="report-table-scroll"><table className="report-table"><thead><tr>{["월", "업무 투입", "회사 퇴사", "순증감", "운영 인원"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{result.months.map((item) => <tr key={item.month}><th scope="row">{item.month}</th><td>{item.entries}명</td><td>{item.exits}명</td><td>{item.net > 0 ? "+" : ""}{item.net}명</td><td>{item.headcount}명</td></tr>)}</tbody></table></div></Panel>
    </>}
  </div>;
}
