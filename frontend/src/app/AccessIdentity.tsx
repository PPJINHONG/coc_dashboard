import Icon from "../shared/components/Icon";

export default function AccessIdentity() {
  return (
    <aside className="access-identity" aria-labelledby="access-identity-title">
      <div className="access-identity-content">
        <Icon name="cloud" className="access-cloud" />
        <img className="access-company-logo" src="/solomontech.png" alt="Solomontech" />
        <h2 id="access-identity-title">Cloud Operations Center</h2>
        <p className="access-team">Solomontech AIDC사업부 클라우드운영팀</p>
      </div>
    </aside>
  );
}
