import { useEffect, useState } from "react";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { staffTrend, type StaffTrend } from "./api";
import { REGIONS } from "./fields";
import { StaffHeadcountChart, StaffMovementChart } from "./StaffTrendChart";

const EMPLOYMENT = [
  { key: "hires", label: "입사", tone: "staff-trend-blue" },
  { key: "resignations", label: "퇴사", tone: "staff-trend-plum" },
] as const;
const ASSIGNMENT = [
  { key: "deployments", label: "업무 투입", tone: "staff-trend-teal" },
  { key: "assignment_ends", label: "업무 종료", tone: "staff-trend-slate" },
] as const;

export default function StaffTrends({ month, revision }: { month: string; revision: number }) {
  const [country, setCountry] = useState("");
  const [company, setCompany] = useState("");
  const [result, setResult] = useState<StaffTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    staffTrend(month, country, company)
      .then((value) => { if (active) setResult(value); })
      .catch((cause) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, country, company, revision]);

  return <div className="report-sections staff-trends">
    <header className="section-head">
      <div><h1>인력 추이</h1><p className="section-sub">기준 월까지 12개월간의 입사·퇴사와 업무 배치 현황</p></div>
      <div className="staff-trend-filters">
        <label>권역
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="">전체 권역</option>
            {Object.entries(REGIONS).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}
          </select>
        </label>
        <label>소속사
          <select value={company} onChange={(event) => setCompany(event.target.value)}>
            <option value="">전체 소속사</option>
            {result?.companies.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
    </header>
    <ErrorMessage message={error} />
    {loading && <p role="status">인력 추이를 불러오는 중입니다…</p>}
    {result && !loading && !error && <>
      <div className="staff-trend-grid">
        <StaffMovementChart months={result.months} title="월별 입사 · 퇴사" series={EMPLOYMENT} />
        <StaffMovementChart months={result.months} title="월별 업무 투입 · 종료" series={ASSIGNMENT} />
      </div>
      <StaffHeadcountChart months={result.months} />
      {result.missing_dates > 0 && <p className="staff-trend-footnote">업무 투입일이 없는 {result.missing_dates}명은 날짜 기반 운영 인원 집계에서 제외됩니다.</p>}
    </>}
  </div>;
}
