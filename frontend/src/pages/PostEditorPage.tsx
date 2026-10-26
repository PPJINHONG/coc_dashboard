import { useEffect, useState, type FormEvent } from 'react';
import {
  createPost,
  getPost,
  updatePost,
  type PostDetail,
  type PostImage,
} from '../api/board';
import { ApiError, MSG_INVALID_INPUT, MSG_SERVER } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import ImageUploader from '../components/ImageUploader';

const MSG_EMPTY_TITLE = '제목을 입력해 주세요.';
const MSG_EMPTY_CONTENT = '내용을 입력해 주세요.';

interface Props {
  // 수정 모드면 대상 글 id, 작성 모드면 undefined
  postId?: number;
  onSaved: (post: PostDetail) => void;
  onCancel: () => void;
}

export default function PostEditorPage({ postId, onSaved, onCancel }: Props) {
  const { handleAuthError } = useAuth();
  const isEdit = postId !== undefined;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<PostImage[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // 수정 모드: 기존 글을 불러와 폼 채우기
  useEffect(() => {
    if (postId === undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const post = await getPost(postId);
        if (cancelled) return;
        setTitle(post.title);
        setContent(post.content);
        setImages(post.images);
      } catch (err) {
        if (cancelled) return;
        if (handleAuthError(err)) return;
        setError(err instanceof ApiError ? err.message : MSG_SERVER);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, handleAuthError]);

  function validate(): boolean {
    let ok = true;
    if (!title.trim()) {
      setTitleError(MSG_EMPTY_TITLE);
      ok = false;
    }
    if (!content.trim()) {
      setContentError(MSG_EMPTY_CONTENT);
      ok = false;
    }
    return ok;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || uploadBusy) return;
    setTitleError(null);
    setContentError(null);
    setError(null);
    if (!validate()) return;

    setSaving(true);
    const imageIds = images.map((img) => img.id);
    try {
      const saved = isEdit
        ? await updatePost(postId as number, { title: title.trim(), content, image_ids: imageIds })
        : await createPost({ title: title.trim(), content, image_ids: imageIds });
      onSaved(saved);
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.status === 400) {
        const t = err.fieldErrors.title?.[0];
        const c = err.fieldErrors.content?.[0];
        if (t) setTitleError(t);
        if (c) setContentError(c);
        setError(err.message || MSG_INVALID_INPUT);
      } else {
        setError(err instanceof ApiError ? err.message : MSG_SERVER);
      }
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="board">
        <p role="status" className="loading-inline">
          불러오는 중…
        </p>
      </section>
    );
  }

  const busy = saving || uploadBusy;

  return (
    <section className="board">
      <header className="section-head">
        <div className="section-title">
          <div className="section-ico" aria-hidden="true">✎</div>
          <div>
            <h1>{isEdit ? '글 수정' : '새 글 작성'}</h1>
            <p className="section-sub">
              {isEdit ? 'Edit Post · 제목·내용·이미지 수정' : 'New Post · 제목·내용·이미지 입력'}
            </p>
          </div>
        </div>
      </header>

      <ErrorMessage message={error} />

      <form onSubmit={onSubmit} noValidate className="post-form">
        <div className="post-form-panel">
          <div className="field">
            <label htmlFor="post-title">제목</label>
            <input
              id="post-title"
              name="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? 'post-title-error' : undefined}
              disabled={busy}
            />
            <ErrorMessage id="post-title-error" message={titleError} />
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="post-content">내용</label>
            <textarea
              id="post-content"
              name="post-content"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              aria-invalid={contentError ? true : undefined}
              aria-describedby={contentError ? 'post-content-error' : undefined}
              disabled={busy}
            />
            <ErrorMessage id="post-content-error" message={contentError} />
          </div>

          <div style={{ marginTop: 16 }}>
            <ImageUploader images={images} onChange={setImages} onBusyChange={setUploadBusy} />
          </div>
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {saving ? '저장 중…' : '저장'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            취소
          </button>
        </div>
      </form>
    </section>
  );
}
