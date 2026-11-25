import { useState, type FormEvent } from "react";
import { ApiError } from "../../shared/api/client";
import ErrorMessage from "../../shared/components/ErrorMessage";
import type {
  HandoverCategory,
  HandoverPriority,
  HandoverRegion,
  HandoverStatus,
  RegionalHandover,
  RegionalHandoverInput,
} from "./api";
import RichTextEditor from "./RichTextEditor";


function initialValues(handover?: RegionalHandover): RegionalHandoverInput {
  if (handover) {
    return {
      region: handover.region,
      priority: handover.priority,
      status: handover.status,
      category: handover.category,
      title: handover.title,
      content_html: handover.content_html,
    };
  }
  return {
    region: "KR",
    priority: "normal",
    status: "in_progress",
    category: "issue",
    title: "",
    content_html: "<p></p>",
  };
}

export default function HandoverForm({
  handover,
  onSubmit,
  onCancel,
  onDirty,
}: {
  handover?: RegionalHandover;
  onSubmit: (values: RegionalHandoverInput) => Promise<void>;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [values, setValues] = useState(() => initialValues(handover));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function change<K extends keyof RegionalHandoverInput>(key: K, value: RegionalHandoverInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    onDirty(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(values);
      onDirty(false);
    } catch (cause) {
      const fieldError = cause instanceof ApiError && Object.values(cause.fieldErrors).flat()[0];
      setError(fieldError || (cause instanceof Error ? cause.message : "핸드오버를 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="handover-form" onSubmit={submit}>
      <fieldset disabled={saving}>
        <div className="handover-form-grid">
          <label>
            <span>권역</span>
            <select value={values.region} onChange={(event) => change("region", event.target.value as HandoverRegion)}>
              <option value="KR">KR</option>
              <option value="EU">EU</option>
              <option value="NA">NA</option>
            </select>
          </label>
          <label>
            <span>구분</span>
            <select value={values.category} onChange={(event) => change("category", event.target.value as HandoverCategory)}>
              <option value="issue">이슈</option>
              <option value="notice">공지</option>
            </select>
          </label>
          <label>
            <span>중요도</span>
            <select value={values.priority} onChange={(event) => change("priority", event.target.value as HandoverPriority)}>
              <option value="high">중요</option>
              <option value="normal">일반</option>
            </select>
          </label>
          <label>
            <span>상태</span>
            <select value={values.status} onChange={(event) => change("status", event.target.value as HandoverStatus)}>
              <option value="in_progress">진행 중</option>
              <option value="completed">완료</option>
            </select>
          </label>
          <label className="handover-form-title">
            <span>제목</span>
            <input
              value={values.title}
              maxLength={200}
              placeholder="다음 권역에 전달할 핵심 내용을 입력하세요."
              onChange={(event) => change("title", event.target.value)}
              required
            />
          </label>
        </div>
        <div className="handover-content-field">
          <span>상세 내용</span>
          <RichTextEditor value={values.content_html} onChange={(value) => change("content_html", value)} />
        </div>
      </fieldset>
      {error && <ErrorMessage message={error} />}
      <div className="actions handover-form-actions">
        <button type="button" className="btn" disabled={saving} onClick={onCancel}>취소</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "저장 중…" : handover ? "변경 저장" : "핸드오버 등록"}
        </button>
      </div>
    </form>
  );
}
