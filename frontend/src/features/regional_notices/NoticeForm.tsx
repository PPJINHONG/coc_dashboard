import { useEffect, useState, type FormEvent } from "react";
import { changeScheduleRegion, nextHour, regionalInput, scheduleZoneLabel, type ScheduleRegion } from "../../shared/regionalTime";
import type { RegionalNotice, RegionalNoticeInput } from "./api";


export default function NoticeForm({
  notice,
  month,
  busy,
  error,
  onSubmit,
  onCancel,
  onDirty,
}: {
  notice: RegionalNotice | null;
  month: string;
  busy: boolean;
  error: string;
  onSubmit: (values: RegionalNoticeInput) => Promise<void>;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [initial] = useState<RegionalNoticeInput>(() => {
    const country = notice?.country_code ?? "KR";
    const next = regionalInput(nextHour(), country);
    return {
      country_code: country,
      scheduled_local: notice ? regionalInput(notice.scheduled_at, country)
        : next.startsWith(month) ? next : `${month}-01T09:00`,
      title: notice?.title ?? "",
      content: notice?.content ?? "",
      category: notice?.category ?? "정기점검",
    };
  });
  const [values, setValues] = useState(initial);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);

  function update<K extends keyof RegionalNoticeInput>(key: K, value: RegionalNoticeInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <form className="regional-notice-form" onSubmit={submit}>
      <div className="regional-notice-form-intro">
        <span>{notice ? "EDIT NOTICE" : "NEW NOTICE"}</span>
        <strong>{notice ? "작업공지 내용을 수정합니다." : "월간 타임라인에 새 작업을 등록합니다."}</strong>
        {!notice && <p>작성자는 로그인한 계정의 이름으로 기록됩니다.</p>}
      </div>

      {error && <p className="error">{error}</p>}

      <fieldset disabled={busy}>
        <div className="regional-notice-form-grid">
          <label>
            <span>리전</span>
            <select
              required
              value={values.country_code}
              onChange={(event) => {
                const country = event.target.value as ScheduleRegion;
                setValues((current) => ({
                  ...current, country_code: country,
                  scheduled_local: changeScheduleRegion(current.scheduled_local, current.country_code, country, notice?.scheduled_at),
                }));
              }}
            >
              {(["KR", "EU", "NA"] as const).map((country) => <option key={country}>{country}</option>)}
            </select>
          </label>
          <label>
            <span>작업 일정 · {scheduleZoneLabel(values.scheduled_local, values.country_code, notice?.scheduled_at)}</span>
            <input
              required
              type="datetime-local"
              value={values.scheduled_local}
              onChange={(event) => update("scheduled_local", event.target.value)}
            />
          </label>
          <label className="regional-notice-form-wide">
            <span>작업 카테고리</span>
            <input
              required
              maxLength={80}
              list="regional-notice-categories"
              value={values.category}
              onChange={(event) => update("category", event.target.value)}
              placeholder="예: 정기점검"
            />
            <datalist id="regional-notice-categories">
              <option value="정기점검" />
              <option value="변경작업" />
              <option value="보안작업" />
              <option value="복구점검" />
              <option value="긴급작업" />
            </datalist>
          </label>
          <label className="regional-notice-form-wide">
            <span>작업 제목</span>
            <input
              required
              maxLength={200}
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="작업 목적이 드러나는 제목을 입력하세요"
            />
          </label>
          <label className="regional-notice-form-wide">
            <span>작업 내용</span>
            <textarea
              required
              rows={8}
              value={values.content}
              onChange={(event) => update("content", event.target.value)}
              placeholder="영향 범위와 작업 내용을 입력하세요"
            />
          </label>
        </div>
      </fieldset>

      <div className="regional-notice-form-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>취소</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !dirty}>
          {busy ? "저장 중…" : notice ? "수정사항 저장" : "작업공지 등록"}
        </button>
      </div>
    </form>
  );
}
