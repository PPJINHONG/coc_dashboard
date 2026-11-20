import { useEffect, useState } from "react";
import type { FeaturePageProps } from "../../shared/feature";
import type { SectionConfig } from "../../shared/sections/types";
import ErrorMessage from "../../shared/components/ErrorMessage";
import { errorMessage } from "../../shared/errors";
import { staffOptions, type StaffOptions } from "./api";
import StaffCalendar from "./StaffCalendar";
import StaffDirectory from "./StaffDirectory";
import StaffTrends from "./StaffTrends";

export type StaffPageProps = Pick<
  FeaturePageProps,
  "data" | "snapshot" | "user" | "refresh" | "setDirty" | "setBusy"
> & { section: SectionConfig };

export type StaffView = "people" | "trend" | "calendar";

export default function StaffPage(
  props: StaffPageProps & { view: StaffView },
) {
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (props.view === "trend") return;
    let active = true;
    staffOptions()
      .then((value) => {
        if (active) {
          setOptions(value);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [props.view, props.snapshot.revision, props.user?.id, retry]);

  if (props.view === "trend") {
    return (
      <StaffTrends
        month={props.snapshot.month}
        revision={props.snapshot.revision}
      />
    );
  }

  if (!options) {
    return (
      <div className="staff-workspace">
        <ErrorMessage message={error} />
        {error ? (
          <button className="btn" onClick={() => setRetry((value) => value + 1)}>
            다시 불러오기
          </button>
        ) : (
          <p role="status">운영 인력 설정을 불러오고 있습니다…</p>
        )}
      </div>
    );
  }

  if (props.view === "calendar") {
    return (
      <div className="staff-workspace">
        <div className="report-sections staff-page staff-calendar-page">
          <header className="section-head">
            <div>
              <h1>캘린더</h1>
              <p className="section-sub">
                전체 권역의 연차·결혼휴가 일정을 월간 또는 주간으로 확인합니다.
              </p>
            </div>
          </header>
          <StaffCalendar
            {...props}
            options={options}
            country={country}
            onCountry={setCountry}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="staff-workspace">
      <StaffDirectory {...props} options={options} />
    </div>
  );
}
