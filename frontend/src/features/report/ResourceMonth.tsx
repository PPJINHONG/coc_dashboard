import type { ReportFigure } from "../../shared/featureReport";
import Icon from "../../shared/components/Icon";

function Quantity({ figure }: { figure: ReportFigure }) {
  if (figure.value == null) return <span className="inventory-missing">{figure.incomplete ? "미입력" : "미등록"}</span>;
  return <>{figure.value.toLocaleString("ko-KR")}<small>{figure.unit}</small>
    {figure.incomplete && <small>+ 미입력</small>}</>;
}

export default function ResourceMonth({ regionCount, figures, month }: {
  regionCount: number; figures: ReportFigure[]; month: string;
}) {
  return <section className="inventory-summary" aria-label={month + " 전체 자원 현황"}>
    <header><div><h3>전체 자원 현황</h3><time dateTime={month}>{month} 기준</time></div>
      <span><Icon name="globe" size={16}/>등록 리전 {regionCount.toLocaleString("ko-KR")}개</span>
    </header>
    <dl>{figures.map((figure) => <div key={figure.label}>
      <dt>{figure.label}</dt><dd><Quantity figure={figure}/></dd>
    </div>)}</dl>
  </section>;
}
