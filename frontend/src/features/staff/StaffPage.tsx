import { useEffect, useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import type { SectionConfig } from "../../shared/sections/types";
import ErrorMessage from "../../shared/components/ErrorMessage";
import Modal from "../../shared/components/Modal";
import { errorMessage } from "../../shared/errors";
import { staffOptions, type StaffOptions } from "./api";
import StaffDirectory from "./StaffDirectory";
import StaffCalendar from "./StaffCalendar";
import StaffTrends from "./StaffTrends";

export type StaffPageProps = Pick<FeaturePageProps, "data" | "snapshot" | "user" | "refresh" | "setDirty" | "setBusy"> & { section: SectionConfig };
type Tab = "people" | "calendar" | "trend";
export default function StaffPage(props: StaffPageProps) {
  const [tab, setTab] = useState<Tab>("people");
  const [pending, setPending] = useState<Tab | null>(null);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    staffOptions().then((value) => { if (active) { setOptions(value); setError(""); } })
      .catch((cause) => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [props.snapshot.revision, props.user?.id, retry]);
  const shared = { ...props, setDirty: (value: boolean) => { setDirty(value); props.setDirty(value); }, setBusy: (value: boolean) => { setBusy(value); props.setBusy(value); } };
  return <div className="staff-workspace">
    <nav className="staff-tabs" aria-label="운영 인력 하위 메뉴">{([["people", "인력 목록"], ["calendar", "캘린더"], ["trend", "인력 추이"]] as const).map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} aria-current={tab === value ? "page" : undefined} disabled={busy} onClick={() => { if (tab !== value) { if (dirty) setPending(value); else setTab(value); } }}>{label}</button>)}</nav>
    <ErrorMessage message={error} />
    {error && <button className="btn" onClick={() => setRetry(retry + 1)}>다시 불러오기</button>}
    {!options ? <p role="status">운영 인력 설정을 불러오고 있습니다…</p> : tab === "people" ? <StaffDirectory {...shared} options={options} /> : tab === "calendar" ? <StaffCalendar {...shared} options={options} /> : <StaffTrends month={props.snapshot.month} revision={props.snapshot.revision} />}
    {pending && <Modal title="작성 중인 내용" onClose={() => setPending(null)}><p>저장하지 않은 내용을 버리고 이동하시겠습니까?</p><div className="actions"><button className="btn" onClick={() => setPending(null)}>계속 작성</button><button className="btn btn-primary" onClick={() => { shared.setDirty(false); setTab(pending); setPending(null); }}>이동</button></div></Modal>}
  </div>;
}
