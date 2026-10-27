// 업로드 전 canvas로 이미지를 축소·재인코딩한다.
// Nginx 기본 요청 크기 제한(1MB)을 넘지 않도록 900KB 이하를 목표로,
// 긴 변 최대 1600px부터 줄이면서 JPEG/WebP 품질을 함께 낮춘다.

const MAX_BYTES = 900 * 1024; // 900KB
const START_LONG_EDGE = 1600; // 긴 변 시작 한계(px)
const MIN_LONG_EDGE = 640; // 더는 줄이지 않는 하한(px)
const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

// 애니메이션 GIF는 canvas 재인코딩 시 첫 프레임만 남으므로, 충분히 작으면 원본을 유지한다.
const PASSTHROUGH_TYPES = new Set(['image/gif']);

export interface PreparedImage {
  file: File;
  // 원본이 이미 작아 변환하지 않은 경우 true
  passthrough: boolean;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function drawScaled(img: HTMLImageElement, longEdge: number): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, longEdge / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 변환할 수 없습니다.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function renameToJpeg(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.jpg`;
}

// 서버 허용 포맷: png/jpeg/gif/webp.
// 재인코딩 대상은 손실 압축이 가능한 JPEG로 통일한다(용량 제어가 쉽다).
export async function prepareImage(file: File): Promise<PreparedImage> {
  // 작은 GIF 등은 원본 그대로 통과(애니메이션 보존)
  if (PASSTHROUGH_TYPES.has(file.type) && file.size <= MAX_BYTES) {
    return { file, passthrough: true };
  }
  // 이미 충분히 작은 정적 이미지도 그대로 통과
  if (!PASSTHROUGH_TYPES.has(file.type) && file.size <= MAX_BYTES) {
    return { file, passthrough: true };
  }

  const img = await loadImage(file);
  const outType = 'image/jpeg';

  for (let longEdge = START_LONG_EDGE; longEdge >= MIN_LONG_EDGE; longEdge = Math.round(longEdge * 0.8)) {
    const canvas = drawScaled(img, longEdge);
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, outType, quality);
      if (blob && blob.size <= MAX_BYTES) {
        return {
          file: new File([blob], renameToJpeg(file.name), { type: outType }),
          passthrough: false,
        };
      }
    }
  }

  // 하한까지 줄였는데도 목표를 못 맞추면 가장 작은 설정으로 한 번 더 만들어 반환한다.
  const canvas = drawScaled(img, MIN_LONG_EDGE);
  const blob = await canvasToBlob(canvas, outType, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
  if (!blob) throw new Error('이미지를 변환할 수 없습니다.');
  return {
    file: new File([blob], renameToJpeg(file.name), { type: outType }),
    passthrough: false,
  };
}
