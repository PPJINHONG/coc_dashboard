interface Props {
  icon: string;
  title: string;
  subtitle: string;
  message: string;
}

// 아직 기능이 없는 탭(대시보드·유저관리)용 "준비 중" 화면.
// 게시판과 동일한 섹션 헤더 + 다크 안내 패널 스타일을 쓴다.
export default function PlaceholderPage({ icon, title, subtitle, message }: Props) {
  return (
    <section>
      <header className="section-head">
        <div className="section-title">
          <div className="section-ico" aria-hidden="true">{icon}</div>
          <div>
            <h1>{title}</h1>
            <p className="section-sub">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="coming-soon">
        <div className="cs-ico" aria-hidden="true">{icon}</div>
        <span className="cs-badge">준비 중</span>
        <h2>{title} 기능은 아직 준비 중입니다</h2>
        <p>{message}</p>
      </div>
    </section>
  );
}
