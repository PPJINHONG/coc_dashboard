import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { uploadImage, type PostImage } from '../api/board';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from './ErrorMessage';

const MAX_IMAGES = 5;
const MSG_MAX = `이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`;
const MSG_UPLOAD_FAIL = '이미지 업로드에 실패했습니다.';

interface Props {
  images: PostImage[];
  onChange: (next: PostImage[]) => void;
  // 업로드 진행 중 여부를 상위에 알려 저장 버튼을 잠근다.
  onBusyChange?: (busy: boolean) => void;
}

// 여러 장 파일 선택 + 클립보드 붙여넣기(Ctrl+V) 업로드, 썸네일 미리보기·개별 제거.
export default function ImageUploader({ images, onChange, onBusyChange }: Props) {
  const { handleAuthError } = useAuth();
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onBusyChange?.(uploading > 0);
  }, [uploading, onBusyChange]);

  async function uploadFiles(files: File[]) {
    setError(null);
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(MSG_MAX);
      return;
    }
    const slice = imageFiles.slice(0, remaining);
    if (imageFiles.length > remaining) setError(MSG_MAX);

    setUploading((n) => n + slice.length);
    let current = [...images];
    try {
      for (const file of slice) {
        try {
          const uploaded = await uploadImage(file);
          current = [...current, uploaded];
          onChange(current);
        } catch (err) {
          if (handleAuthError(err)) return;
          setError(err instanceof ApiError ? err.message : MSG_UPLOAD_FAIL);
        } finally {
          setUploading((n) => n - 1);
        }
      }
    } catch {
      setError(MSG_UPLOAD_FAIL);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    void uploadFiles(files);
    // 같은 파일 재선택 허용
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && file.type.startsWith('image/')) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void uploadFiles(files);
    }
  }

  function removeAt(id: number) {
    onChange(images.filter((img) => img.id !== id));
  }

  const atMax = images.length >= MAX_IMAGES;

  return (
    <div
      className="image-uploader"
      onPaste={onPaste}
      tabIndex={0}
      role="group"
      aria-label="이미지 첨부 (클립보드 붙여넣기 지원)"
    >
      <div className="uploader-drop">
        <div className="field">
          <label htmlFor="post-images">이미지 첨부 (최대 {MAX_IMAGES}장)</label>
          <input
            ref={fileInputRef}
            id="post-images"
            name="post-images"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            onChange={onFileChange}
            disabled={atMax || uploading > 0}
          />
          <p className="hint">파일 선택 또는 이 영역을 클릭한 뒤 Ctrl+V로 붙여넣기할 수 있습니다.</p>
        </div>

        <ErrorMessage message={error} />
        {uploading > 0 && (
          <p role="status" className="loading-inline">
            이미지 업로드 중… ({uploading}장)
          </p>
        )}

        {images.length > 0 && (
          <ul className="thumbs">
            {images.map((img) => (
              <li key={img.id} className="thumb">
                <img src={img.url} alt="첨부 이미지 미리보기" />
                <button type="button" className="thumb-remove" onClick={() => removeAt(img.id)}>
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
