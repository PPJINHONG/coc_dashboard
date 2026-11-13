import { useState, type FormEvent } from "react";
import ErrorMessage from "../../shared/components/ErrorMessage";
import type {
  AssigneeRegion,
  RegionalRequest,
  RegionalRequestInput,
  RequestStatus,
  ScheduleTimezone,
} from "./api";
import RichTextEditor from "./RichTextEditor";


type Mode = "create" | "content" | "assignment";

function localInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaults(): RegionalRequestInput {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    region: "KR",
    title: "",
    content_html: "<p></p>",
    requester: "",
    schedule_timezone: "KST",
    schedule_start_local: localInput(start),
    schedule_end_local: localInput(end),
    status: "open",
    assignee_regions: [],
    assignee_name: "",
  };
}

function fromTicket(ticket: RegionalRequest): RegionalRequestInput {
  return {
    region: ticket.region,
    title: ticket.title,
    content_html: ticket.content_html,
    requester: ticket.requester,
    schedule_timezone: ticket.schedule_timezone,
    schedule_start_local: ticket.schedule_start_display,
    schedule_end_local: ticket.schedule_end_display,
    status: ticket.status,
    assignee_regions: ticket.assignee_regions,
    assignee_name: ticket.assignee_name,
  };
}

export default function RequestForm({
  mode,
  ticket,
  onSubmit,
  onCancel,
  onDirty,
}: {
  mode: Mode;
  ticket?: RegionalRequest;
  onSubmit: (values: RegionalRequestInput) => Promise<void>;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [values, setValues] = useState(() => ticket ? fromTicket(ticket) : defaults());
  const [unassigned, setUnassigned] = useState(() => !ticket?.assignee_name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const assignmentOnly = mode === "assignment";

  function change<K extends keyof RegionalRequestInput>(key: K, value: RegionalRequestInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    onDirty(true);
  }

  function toggleRegion(value: AssigneeRegion) {
    change(
      "assignee_regions",
      values.assignee_regions.includes(value)
        ? values.assignee_regions.filter((region) => region !== value)
        : [...values.assignee_regions, value],
    );
  }

  function setNoAssignee(checked: boolean) {
    setUnassigned(checked);
    if (checked) change("assignee_name", "");
    else onDirty(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({ ...values, assignee_name: unassigned ? "" : values.assignee_name });
      onDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청작업을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`regional-request-form${assignmentOnly ? " is-assignment-only" : ""}`} onSubmit={submit}>
      <fieldset disabled={saving}>
        {!assignmentOnly && (
          <>
            <div className="regional-request-form-grid regional-request-basic-grid">
              <label>
                <span>리전</span>
                <select value={values.region} onChange={(event) => change("region", event.target.value as AssigneeRegion)} required>
                  <option value="KR">KR</option>
                  <option value="NA">NA</option>
                  <option value="EU">EU</option>
                </select>
              </label>
              <label>
                <span>Requester</span>
                <input value={values.requester} maxLength={200} onChange={(event) => change("requester", event.target.value)} required />
              </label>
              <label className="regional-request-form-wide">
                <span>제목</span>
                <input value={values.title} maxLength={200} onChange={(event) => change("title", event.target.value)} required />
              </label>
            </div>
            <div className="regional-request-schedule-box">
              <div className="regional-request-section-title"><strong>작업 일정</strong></div>
              <div className="regional-request-form-grid regional-request-schedule-grid">
                <label>
                  <span>시간대</span>
                  <select value={values.schedule_timezone} onChange={(event) => change("schedule_timezone", event.target.value as ScheduleTimezone)}>
                    <option value="UTC">미국 · UTC</option>
                    <option value="KST">한국 · KST</option>
                    <option value="CET">유럽 · CET</option>
                  </select>
                </label>
                <label>
                  <span>시작 시간</span>
                  <input type="datetime-local" value={values.schedule_start_local} onChange={(event) => change("schedule_start_local", event.target.value)} required />
                </label>
                <label>
                  <span>종료 시간</span>
                  <input type="datetime-local" value={values.schedule_end_local} onChange={(event) => change("schedule_end_local", event.target.value)} required />
                </label>
              </div>
            </div>
            <div className="regional-request-content-field">
              <span>내용</span>
              <RichTextEditor value={values.content_html} onChange={(value) => change("content_html", value)} />
            </div>
          </>
        )}

        <div className="regional-request-assignment-box">
          <div className="regional-request-section-title"><strong>상태 및 담당</strong></div>
          <div className="regional-request-form-grid regional-request-assignment-grid">
            <label>
              <span>상태</span>
              <select value={values.status} onChange={(event) => change("status", event.target.value as RequestStatus)}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <div>
              <span className="regional-request-field-label">담당 권역</span>
              <div className="regional-request-choice-row">
                {(["KR", "NA", "EU"] as AssigneeRegion[]).map((region) => (
                  <label className="regional-request-check-chip" key={region}>
                    <input type="checkbox" checked={values.assignee_regions.includes(region)} onChange={() => toggleRegion(region)} />
                    <span>{region}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="regional-request-assignee-input">
              <div className="regional-request-assignee-label">
                <span className="regional-request-field-label">담당자</span>
                <label className="regional-request-unassigned">
                  <input type="checkbox" checked={unassigned} onChange={(event) => setNoAssignee(event.target.checked)} />
                  미지정
                </label>
              </div>
              <input
                value={values.assignee_name}
                maxLength={200}
                disabled={unassigned || saving}
                placeholder={unassigned ? "담당자 미지정" : "담당자 이름 또는 팀 입력"}
                onChange={(event) => change("assignee_name", event.target.value)}
              />
            </div>
          </div>
        </div>
      </fieldset>
      {error && <ErrorMessage message={error} />}
      <div className="actions regional-request-form-actions">
        <button type="button" className="btn" disabled={saving} onClick={onCancel}>취소</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "저장 중…" : mode === "create" ? "요청작업 생성" : "변경 저장"}</button>
      </div>
    </form>
  );
}
