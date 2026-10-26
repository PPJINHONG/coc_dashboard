// 패널 데이터 처리: 원본 만들기 → 변환 수식 적용 → 대표값 계산 → 단위·색 표시
import type { ColorName, Panel, PanelInput, PanelOptions, Reducer, Unit, VizType } from '../api/dashboard';
import { compile, ExprError, FORMULA_VARS, FUNCTION_VARS } from './expr';

export const GRID_COLUMNS = 24;
export const GRID_ROW_PX = 36;
export const GRID_GAP_PX = 10;
export const PANEL_MIN_W = 3;
export const PANEL_MAX_W = 24;
export const PANEL_MIN_H = 3;
export const PANEL_MAX_H = 20;
export const MAX_FUNCTION_POINTS = 500;

export const VIZ_TYPES: { type: VizType; label: string; icon: string }[] = [
  { type: 'timeseries', label: '시계열', icon: '📈' },
  { type: 'bar', label: '막대', icon: '📊' },
  { type: 'stat', label: '숫자', icon: '🔢' },
  { type: 'gauge', label: '게이지', icon: '⏲️' },
  { type: 'table', label: '표', icon: '▦' },
];

export const COLORS: { name: ColorName; label: string; css: string }[] = [
  { name: 'blue', label: '하늘', css: 'var(--accent)' },
  { name: 'green', label: '초록', css: 'var(--success)' },
  { name: 'purple', label: '보라', css: 'var(--lavender)' },
  { name: 'orange', label: '주황', css: 'var(--warn)' },
  { name: 'red', label: '빨강', css: 'var(--danger)' },
  { name: 'yellow', label: '노랑', css: 'var(--yellow)' },
];

export const UNITS: { unit: Unit; label: string }[] = [
  { unit: 'none', label: '없음' },
  { unit: 'percent', label: '퍼센트 (%)' },
  { unit: 'count', label: '개수 (천 단위 구분)' },
  { unit: 'ms', label: '밀리초 (ms)' },
  { unit: 's', label: '초 (s)' },
  { unit: 'bytes', label: '바이트 (B/KB/MB)' },
  { unit: 'krw', label: '원 (₩)' },
  { unit: 'custom', label: '직접 입력' },
];

export const REDUCERS: { reducer: Reducer; label: string }[] = [
  { reducer: 'last', label: '마지막 값' },
  { reducer: 'first', label: '첫 값' },
  { reducer: 'avg', label: '평균' },
  { reducer: 'sum', label: '합계' },
  { reducer: 'min', label: '최소' },
  { reducer: 'max', label: '최대' },
  { reducer: 'count', label: '개수' },
];

export const DEFAULT_OPTIONS: PanelOptions = {
  unit: 'none',
  unit_suffix: '',
  decimals: null,
  min: null,
  max: null,
  reduce: 'last',
  color: 'blue',
  thresholds: [],
};

export function colorCss(name: ColorName): string {
  return COLORS.find((c) => c.name === name)?.css ?? 'var(--accent)';
}

export function newPanelInput(): PanelInput {
  return {
    title: '새 패널',
    description: '',
    viz_type: 'timeseries',
    source: 'manual',
    values: [
      { label: '1', value: 12 },
      { label: '2', value: 18 },
      { label: '3', value: 15 },
      { label: '4', value: 24 },
      { label: '5', value: 21 },
    ],
    func_expr: 'sin(t) * 10 + 20',
    func_from: 0,
    func_to: 12,
    func_step: 0.25,
    formula: '',
    options: { ...DEFAULT_OPTIONS },
    width: 12,
    height: 8,
  };
}

export function toInput(p: Panel): PanelInput {
  const { id: _id, position: _p, created_at: _c, updated_at: _u, ...rest } = p;
  return { ...rest, options: { ...DEFAULT_OPTIONS, ...p.options } };
}

export interface Point {
  label: string;
  raw: number;
  // 변환 수식 적용 결과. 계산할 수 없으면 null(그래프에서 끊김)
  value: number | null;
}

export interface Series {
  points: Point[];
  // 문법 오류 등으로 그릴 수 없을 때의 안내
  error: string | null;
  // 일부 점이 계산 불가(0으로 나누기 등)일 때의 안내
  warning: string | null;
}

function pointCount(from: number, to: number, step: number): number {
  return Math.floor((to - from) / step + 1e-9) + 1;
}

function trimNumber(n: number): string {
  return String(Number(n.toPrecision(10)));
}

// 원본 데이터 → 변환 수식 적용
export function buildSeries(p: Pick<PanelInput, 'source' | 'values' | 'func_expr' | 'func_from' | 'func_to' | 'func_step' | 'formula'>): Series {
  let base: { label: string; raw: number; t: number }[] = [];
  if (p.source === 'function') {
    if (!p.func_expr.trim()) return { points: [], error: '함수식을 입력해 주세요.', warning: null };
    if (!(p.func_step > 0)) return { points: [], error: '간격은 0보다 커야 합니다.', warning: null };
    if (!(p.func_to >= p.func_from)) return { points: [], error: '끝 값은 시작 값보다 크거나 같아야 합니다.', warning: null };
    const count = pointCount(p.func_from, p.func_to, p.func_step);
    if (count > MAX_FUNCTION_POINTS) {
      return { points: [], error: `점이 ${MAX_FUNCTION_POINTS}개를 넘습니다. 간격을 늘리거나 범위를 줄여 주세요.`, warning: null };
    }
    let fn;
    try {
      fn = compile(p.func_expr, FUNCTION_VARS);
    } catch (err) {
      return { points: [], error: `함수식: ${(err as ExprError).message}`, warning: null };
    }
    for (let k = 0; k < count; k++) {
      const t = p.func_from + k * p.func_step;
      base.push({ label: trimNumber(t), raw: fn({ t }), t });
    }
  } else {
    base = p.values.map((row, idx) => {
      const asNum = Number(row.label);
      return { label: row.label || String(idx + 1), raw: row.value, t: row.label !== '' && Number.isFinite(asNum) ? asNum : idx };
    });
  }

  const formula = p.formula.trim();
  if (!formula) {
    const points = base.map((b) => ({ label: b.label, raw: b.raw, value: Number.isFinite(b.raw) ? b.raw : null }));
    const bad = points.filter((pt) => pt.value === null).length;
    return { points, error: null, warning: bad ? `계산할 수 없는 점 ${bad}개는 그래프에서 비웁니다.` : null };
  }

  let fn;
  try {
    fn = compile(formula, FORMULA_VARS);
  } catch (err) {
    return { points: [], error: `변환 수식: ${(err as ExprError).message}`, warning: null };
  }
  const raws = base.map((b) => b.raw).filter(Number.isFinite);
  const stats = {
    n: base.length,
    sum: raws.reduce((s, v) => s + v, 0),
    avg: raws.length ? raws.reduce((s, v) => s + v, 0) / raws.length : NaN,
    min: raws.length ? Math.min(...raws) : NaN,
    max: raws.length ? Math.max(...raws) : NaN,
  };
  let bad = 0;
  const points = base.map((b, i) => {
    const v = fn({ ...stats, x: b.raw, i, t: b.t, prev: i > 0 ? base[i - 1].raw : b.raw });
    const ok = Number.isFinite(v);
    if (!ok) bad++;
    return { label: b.label, raw: b.raw, value: ok ? v : null };
  });
  return { points, error: null, warning: bad ? `계산할 수 없는 점 ${bad}개는 그래프에서 비웁니다(0으로 나누기 등).` : null };
}

export function reduceValues(values: (number | null)[], reducer: Reducer): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (reducer === 'count') return nums.length;
  if (nums.length === 0) return null;
  switch (reducer) {
    case 'first': return nums[0];
    case 'last': return nums[nums.length - 1];
    case 'sum': return nums.reduce((s, v) => s + v, 0);
    case 'avg': return nums.reduce((s, v) => s + v, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
  }
}

export function reducerLabel(r: Reducer): string {
  return REDUCERS.find((x) => x.reducer === r)?.label ?? r;
}

function fmtNumber(n: number, decimals: number | null): string {
  if (decimals !== null) {
    return n.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  const abs = Math.abs(n);
  const auto = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return n.toLocaleString('ko-KR', { maximumFractionDigits: auto });
}

// 단위·소수 자리 옵션대로 값을 문자열로 만든다.
export function formatValue(v: number | null, o: PanelOptions): string {
  if (v === null || !Number.isFinite(v)) return '-';
  switch (o.unit) {
    case 'percent': return `${fmtNumber(v, o.decimals)}%`;
    case 'ms': return `${fmtNumber(v, o.decimals)} ms`;
    case 's': return `${fmtNumber(v, o.decimals)} s`;
    case 'count': return fmtNumber(v, o.decimals ?? 0);
    case 'krw': return `₩${fmtNumber(v, o.decimals ?? 0)}`;
    case 'custom': return o.unit_suffix ? `${fmtNumber(v, o.decimals)} ${o.unit_suffix}` : fmtNumber(v, o.decimals);
    case 'bytes': {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let x = v;
      let k = 0;
      while (Math.abs(x) >= 1024 && k < units.length - 1) {
        x /= 1024;
        k++;
      }
      return `${fmtNumber(x, o.decimals ?? (k === 0 ? 0 : 1))} ${units[k]}`;
    }
    default: return fmtNumber(v, o.decimals);
  }
}

// 임계값: 값이 각 단계 이상이면 그 색, 어느 단계에도 못 미치면 기본 색
export function colorFor(v: number | null, o: PanelOptions): string {
  let name = o.color;
  if (v !== null) {
    for (const step of o.thresholds) if (v >= step.value) name = step.color;
  }
  return colorCss(name);
}

// 축 눈금: 보기 좋은 간격(1·2·5 × 10^n)으로 나눈다.
export function niceTicks(lo: number, hi: number, maxTicks = 5): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, ticks: [0, 1] };
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  const rough = (hi - lo) / Math.max(1, maxTicks);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min, max, ticks };
}

// 그래프 y 범위: 옵션의 최소·최대를 우선하고, 없으면 데이터와 0을 포함
export function valueRange(values: (number | null)[], o: PanelOptions, includeZero: boolean) {
  const nums = values.filter((v): v is number => v !== null);
  let lo = nums.length ? Math.min(...nums) : 0;
  let hi = nums.length ? Math.max(...nums) : 1;
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  const nice = niceTicks(o.min ?? lo, o.max ?? hi);
  const min = o.min ?? nice.min;
  const max = o.max ?? nice.max;
  return { min, max, ticks: nice.ticks.filter((t) => t >= min - 1e-9 && t <= max + 1e-9) };
}
