import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  createPanel,
  getPanel,
  updatePanel,
  type ColorName,
  type PanelInput,
  type PanelOptions,
  type PanelSource,
  type Reducer,
  type Unit,
} from '../api/dashboard';
import { ApiError, MSG_INVALID_INPUT, MSG_SERVER } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import {
  buildSeries,
  COLORS,
  colorCss,
  formatValue,
  newPanelInput,
  REDUCERS,
  toInput,
  UNITS,
  VIZ_TYPES,
} from '../dashboard/data';
import { checkExpression, FORMULA_VARS, FUNCTION_NAMES, FUNCTION_VARS } from '../dashboard/expr';
import PanelViz from '../dashboard/viz/PanelViz';

interface Props {
  panelId?: number;
  onDone: () => void;
}

// 입력 중인 숫자는 문자열로 들고 있다가 저장·미리보기 때 숫자로 바꾼다('-', '1.' 같은 중간 입력 허용).
interface RowDraft {
  key: number;
  label: string;
  value: string;
}
interface Draft {
  input: PanelInput;
  rows: RowDraft[];
  funcFrom: string;
  funcTo: string;
  funcStep: string;
  min: string;
  max: string;
  thresholds: { key: number; value: string; color: ColorName }[];
}

let seq = 0;
const nextKey = () => ++seq;

function toDraft(input: PanelInput): Draft {
  return {
    input,
    rows: input.values.map((r) => ({ key: nextKey(), label: r.label, value: String(r.value) })),
    funcFrom: String(input.func_from),
    funcTo: String(input.func_to),
    funcStep: String(input.func_step),
    min: input.options.min === null ? '' : String(input.options.min),
    max: input.options.max === null ? '' : String(input.options.max),
    thresholds: input.options.thresholds.map((t) => ({ key: nextKey(), value: String(t.value), color: t.color })),
  };
}

const num = (s: string): number | null => (s.trim() === '' || !Number.isFinite(Number(s)) ? null : Number(s));

// 일괄 입력: 줄마다 "라벨, 값" 또는 "라벨<탭>값" 또는 값만. 한 줄에 숫자만 여러 개면 쉼표·공백으로 나눈다.
function parseBulk(text: string): { rows: { label: string; value: string }[]; error: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && /^[-+\d.eE\s,]+$/.test(lines[0])) {
    const parts = lines[0].split(/[\s,]+/).filter(Boolean);
    if (parts.every((p) => Number.isFinite(Number(p)))) {
      return { rows: parts.map((p, i) => ({ label: String(i + 1), value: p })), error: null };
    }
  }
  const rows: { label: string; value: string }[] = [];
  for (const [i, line] of lines.entries()) {
    const m = /^(.*?)[\t,]\s*([-+]?[\d.]+(?:[eE][-+]?\d+)?)$/.exec(line);
    if (m) rows.push({ label: m[1].trim(), value: m[2] });
    else if (Number.isFinite(Number(line))) rows.push({ label: String(i + 1), value: line });
    else return { rows: [], error: `${i + 1}번째 줄을 읽을 수 없습니다: "${line.slice(0, 30)}"` };
  }
  return { rows, error: null };
}

const FORMULA_EXAMPLES = ['x * 2', 'x / max * 100', 'round(x, 1)', 'x - prev', '(x - avg) / avg * 100', 'clamp(x, 0, 100)'];
const FUNC_EXAMPLES = ['sin(t) * 10 + 20', 't ^ 2', 'exp(t / 4)', 'round(cos(t) * 50 + 50)'];

export default function PanelEditorPage({ panelId, onDone }: Props) {
  const { handleAuthError } = useAuth();
  const isEdit = panelId !== undefined;
  const [draft, setDraft] = useState<Draft | null>(isEdit ? null : toDraft(newPanelInput()));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const ids = { title: useId(), desc: useId(), formula: useId(), func: useId(), bulk: useId() };

  useEffect(() => {
    if (panelId === undefined) return;
    let active = true;
    (async () => {
      try {
        const p = await getPanel(panelId);
        if (active) setDraft(toDraft(toInput(p)));
      } catch (err) {
        if (!active || handleAuthError(err)) return;
        setError(err instanceof ApiError ? err.message : MSG_SERVER);
      }
    })();
    return () => {
      active = false;
    };
  }, [panelId, handleAuthError]);

  // 화면 미리보기용 입력: 숫자로 못 바꾸는 칸은 빼고 만든다.
  const preview: PanelInput | null = useMemo(() => {
    if (!draft) return null;
    const d = draft;
    return {
      ...d.input,
      values: d.rows.filter((r) => num(r.value) !== null).map((r) => ({ label: r.label.trim(), value: num(r.value)! })),
      func_from: num(d.funcFrom) ?? NaN,
      func_to: num(d.funcTo) ?? NaN,
      func_step: num(d.funcStep) ?? NaN,
      options: {
        ...d.input.options,
        min: num(d.min),
        max: num(d.max),
        thresholds: d.thresholds
          .filter((t) => num(t.value) !== null)
          .map((t) => ({ value: num(t.value)!, color: t.color }))
          .sort((a, b) => a.value - b.value),
      },
    };
  }, [draft]);

  if (!draft || !preview) {
    return (
      <section className="board">
        <ErrorMessage message={error} />
        {!error && (
          <p role="status" className="loading-inline">
            불러오는 중…
          </p>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>
          ← 대시보드로
        </button>
      </section>
    );
  }

  const d = draft;
  const set = (patch: Partial<PanelInput>) => setDraft({ ...d, input: { ...d.input, ...patch } });
  const setOpt = (patch: Partial<PanelOptions>) => set({ options: { ...d.input.options, ...patch } });
  const formulaError = d.input.formula.trim() ? checkExpression(d.input.formula, FORMULA_VARS) : null;
  const funcError = d.input.source === 'function' ? (d.input.func_expr.trim() ? checkExpression(d.input.func_expr, FUNCTION_VARS) : '함수식을 입력해 주세요.') : null;
  const series = buildSeries(preview);
  const showReduce = d.input.viz_type === 'stat' || d.input.viz_type === 'gauge';

  function localErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!d.input.title.trim()) e.title = '제목을 입력해 주세요.';
    if (d.input.source === 'manual') {
      const bad = d.rows.findIndex((r) => num(r.value) === null);
      if (bad >= 0) e.values = `${bad + 1}번째 행의 값이 숫자가 아닙니다.`;
      if (d.rows.some((r) => r.label.trim().length > 30)) e.values = '라벨은 30자 이하로 입력해 주세요.';
    } else {
      if (funcError) e.func_expr = funcError;
      if (num(d.funcFrom) === null || num(d.funcTo) === null || num(d.funcStep) === null) e.func_range = '시작·끝·간격에 숫자를 입력해 주세요.';
      else if (series.error && !funcError) e.func_range = series.error;
    }
    if (formulaError) e.formula = formulaError;
    if ((d.min.trim() && num(d.min) === null) || (d.max.trim() && num(d.max) === null)) e.minmax = '최소·최대는 숫자이거나 비워 두어야 합니다.';
    else if (num(d.min) !== null && num(d.max) !== null && num(d.min)! >= num(d.max)!) e.minmax = '최소값은 최대값보다 작아야 합니다.';
    if (d.thresholds.some((t) => num(t.value) === null)) e.thresholds = '임계값에 숫자를 입력해 주세요.';
    return e;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !preview) return;
    setError(null);
    const errs = localErrors();
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setError(MSG_INVALID_INPUT);
      return;
    }
    setSaving(true);
    const body: PanelInput = { ...preview, title: preview.title.trim() };
    try {
      if (isEdit) await updatePanel(panelId as number, body);
      else await createPanel(body);
      onDone();
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.status === 400) {
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.fieldErrors)) fe[k] = v[0];
        setFieldErrors(fe);
        setError(`${MSG_INVALID_INPUT} ${Object.values(fe).join(' ')}`.trim());
      } else {
        setError(err instanceof ApiError ? err.message : MSG_SERVER);
      }
      setSaving(false);
    }
  }

  function applyBulk() {
    const { rows, error: err } = parseBulk(bulkText);
    if (err) {
      setBulkError(err);
      return;
    }
    if (rows.length === 0) {
      setBulkError('입력한 값이 없습니다.');
      return;
    }
    if (rows.length > 200) {
      setBulkError('값은 200개까지 입력할 수 있습니다.');
      return;
    }
    setBulkError(null);
    setDraft({ ...d, rows: rows.map((r) => ({ key: nextKey(), ...r })) });
    setBulkOpen(false);
  }

  const setSource = (source: PanelSource) => set({ source });

  return (
    <section className="panel-editor">
      <form onSubmit={onSubmit} noValidate>
        <header className="editor-bar">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onDone} disabled={saving}>
            ← 대시보드로
          </button>
          <h1>{isEdit ? '패널 편집' : '새 패널'}</h1>
          <div className="editor-bar-actions">
            <button type="button" className="btn btn-secondary" onClick={onDone} disabled={saving}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </header>

        <ErrorMessage message={error} />

        <div className="editor-layout">
          <div className="editor-main">
            {/* 미리보기: 대시보드와 같은 패널 모양 */}
            <section className="dash-panel editor-preview" aria-label="미리보기">
              <header className="dash-panel-head">
                <h2 className="dash-panel-title">{d.input.title || '(제목 없음)'}</h2>
                <span className="badge">미리보기</span>
              </header>
              <div className="dash-panel-body">
                <PanelViz panel={preview} />
              </div>
            </section>

            <section className="editor-section" aria-labelledby="data-head">
              <div className="editor-section-head">
                <h2 id="data-head">데이터</h2>
                <div className="seg" role="radiogroup" aria-label="데이터 입력 방식">
                  {(['manual', 'function'] as PanelSource[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={d.input.source === s}
                      className={d.input.source === s ? 'seg-item active' : 'seg-item'}
                      onClick={() => setSource(s)}
                    >
                      {s === 'manual' ? '직접 입력' : '함수식'}
                    </button>
                  ))}
                </div>
              </div>

              {d.input.source === 'manual' ? (
                <>
                  <div className="rows-table-wrap">
                    <table className="rows-table">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">라벨</th>
                          <th scope="col">값</th>
                          <th scope="col">
                            <span className="sr-only">행 삭제</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.rows.map((r, i) => (
                          <tr key={r.key}>
                            <td className="muted idx">{i + 1}</td>
                            <td>
                              <input
                                aria-label={`${i + 1}번째 라벨`}
                                value={r.label}
                                maxLength={30}
                                onChange={(e) => setDraft({ ...d, rows: d.rows.map((x) => (x.key === r.key ? { ...x, label: e.target.value } : x)) })}
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`${i + 1}번째 값`}
                                inputMode="decimal"
                                value={r.value}
                                aria-invalid={num(r.value) === null ? true : undefined}
                                onChange={(e) => setDraft({ ...d, rows: d.rows.map((x) => (x.key === r.key ? { ...x, value: e.target.value } : x)) })}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`${i + 1}번째 행 삭제`}
                                onClick={() => setDraft({ ...d, rows: d.rows.filter((x) => x.key !== r.key) })}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {d.rows.length === 0 && <p className="hint">행이 없습니다. 아래에서 추가하거나 일괄 입력하세요.</p>}
                  <ErrorMessage message={fieldErrors.values} />
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={d.rows.length >= 200}
                      onClick={() => setDraft({ ...d, rows: [...d.rows, { key: nextKey(), label: String(d.rows.length + 1), value: '0' }] })}
                    >
                      + 행 추가
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-expanded={bulkOpen}
                      onClick={() => {
                        setBulkOpen((v) => !v);
                        setBulkText(d.rows.map((r) => `${r.label}, ${r.value}`).join('\n'));
                        setBulkError(null);
                      }}
                    >
                      일괄 입력
                    </button>
                  </div>
                  {bulkOpen && (
                    <div className="field bulk">
                      <label htmlFor={ids.bulk}>한 줄에 "라벨, 값" (또는 값만, 엑셀에서 두 열 복사 가능)</label>
                      <textarea id={ids.bulk} rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
                      <ErrorMessage message={bulkError} />
                      <div className="actions">
                        <button type="button" className="btn btn-primary btn-sm" onClick={applyBulk}>
                          적용 (기존 행 교체)
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBulkOpen(false)}>
                          닫기
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor={ids.func}>함수식 (변수 t)</label>
                    <input
                      id={ids.func}
                      className="mono-input"
                      value={d.input.func_expr}
                      maxLength={200}
                      placeholder="예: sin(t) * 10 + 20"
                      aria-invalid={funcError ? true : undefined}
                      onChange={(e) => set({ func_expr: e.target.value })}
                    />
                    <ErrorMessage message={funcError ?? fieldErrors.func_expr} />
                    <div className="chips" aria-label="함수식 예시">
                      {FUNC_EXAMPLES.map((ex) => (
                        <button key={ex} type="button" className="chip" onClick={() => set({ func_expr: ex })}>
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field-row">
                    {(
                      [
                        ['funcFrom', 't 시작'],
                        ['funcTo', 't 끝'],
                        ['funcStep', '간격'],
                      ] as const
                    ).map(([k, label]) => (
                      <div className="field" key={k}>
                        <label htmlFor={`${ids.func}-${k}`}>{label}</label>
                        <input
                          id={`${ids.func}-${k}`}
                          inputMode="decimal"
                          value={d[k]}
                          aria-invalid={num(d[k]) === null ? true : undefined}
                          onChange={(e) => setDraft({ ...d, [k]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  <ErrorMessage message={fieldErrors.func_range ?? fieldErrors.func_step ?? fieldErrors.func_to} />
                  {!series.error && <p className="hint">점 {series.points.length}개를 만듭니다(최대 500개).</p>}
                </>
              )}
            </section>

            <section className="editor-section" aria-labelledby="formula-head">
              <div className="editor-section-head">
                <h2 id="formula-head">변환 수식</h2>
                <span className="hint">비워 두면 원본 값을 그대로 씁니다.</span>
              </div>
              <div className="field">
                <label htmlFor={ids.formula}>결과 = </label>
                <input
                  id={ids.formula}
                  className="mono-input"
                  value={d.input.formula}
                  maxLength={200}
                  placeholder="예: x / max * 100"
                  aria-invalid={formulaError ? true : undefined}
                  aria-describedby={`${ids.formula}-help`}
                  onChange={(e) => set({ formula: e.target.value })}
                />
                <ErrorMessage message={formulaError ?? fieldErrors.formula} />
                <div className="chips" aria-label="변환 수식 예시">
                  {FORMULA_EXAMPLES.map((ex) => (
                    <button key={ex} type="button" className="chip" onClick={() => set({ formula: ex })}>
                      {ex}
                    </button>
                  ))}
                </div>
                <dl className="expr-help" id={`${ids.formula}-help`}>
                  <dt>변수</dt>
                  <dd>
                    <code>x</code> 원본 값 · <code>i</code> 순번(0부터) · <code>n</code> 개수 · <code>t</code> 라벨 숫자 · <code>prev</code> 이전 원본 값 ·{' '}
                    <code>sum</code> <code>avg</code> <code>min</code> <code>max</code> 원본 전체 통계 · <code>pi</code> <code>e</code>
                  </dd>
                  <dt>연산</dt>
                  <dd>
                    <code>+ - * / % ^</code> 괄호 <code>( )</code>
                  </dd>
                  <dt>함수</dt>
                  <dd>{FUNCTION_NAMES.map((f) => <code key={f}>{f}</code>)}</dd>
                </dl>
              </div>
              {!series.error && series.points.length > 0 && (
                <div className="rows-table-wrap compact">
                  <table className="rows-table">
                    <caption className="sr-only">변환 결과 미리보기</caption>
                    <thead>
                      <tr>
                        <th scope="col">라벨</th>
                        <th scope="col" className="num">원본</th>
                        <th scope="col" className="num">결과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.points.slice(0, 6).map((p, i) => (
                        <tr key={i}>
                          <td className="label">{p.label}</td>
                          <td className="num muted">{formatValue(p.raw, { ...preview.options, unit: 'none', decimals: null })}</td>
                          <td className="num">{formatValue(p.value, preview.options)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {series.points.length > 6 && <p className="hint">… 외 {series.points.length - 6}개</p>}
                </div>
              )}
            </section>
          </div>

          <aside className="editor-options" aria-label="패널 옵션">
            <section className="opt-group">
              <h2>패널</h2>
              <div className="field">
                <label htmlFor={ids.title}>제목</label>
                <input
                  id={ids.title}
                  value={d.input.title}
                  maxLength={100}
                  aria-invalid={fieldErrors.title ? true : undefined}
                  aria-describedby={fieldErrors.title ? `${ids.title}-err` : undefined}
                  onChange={(e) => set({ title: e.target.value })}
                />
                <ErrorMessage id={`${ids.title}-err`} message={fieldErrors.title} />
              </div>
              <div className="field">
                <label htmlFor={ids.desc}>설명 (선택)</label>
                <textarea id={ids.desc} rows={2} maxLength={300} value={d.input.description} onChange={(e) => set({ description: e.target.value })} />
              </div>
            </section>

            <section className="opt-group">
              <h2 id="viz-head">시각화</h2>
              <div className="viz-picker" role="radiogroup" aria-labelledby="viz-head">
                {VIZ_TYPES.map((v) => (
                  <button
                    key={v.type}
                    type="button"
                    role="radio"
                    aria-checked={d.input.viz_type === v.type}
                    className={d.input.viz_type === v.type ? 'viz-card active' : 'viz-card'}
                    onClick={() => set({ viz_type: v.type })}
                  >
                    <span aria-hidden="true" className="viz-card-ico">{v.icon}</span>
                    {v.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="opt-group">
              <h2>표준 옵션</h2>
              <div className="field">
                <label htmlFor="opt-unit">단위</label>
                <select id="opt-unit" value={d.input.options.unit} onChange={(e) => setOpt({ unit: e.target.value as Unit })}>
                  {UNITS.map((u) => (
                    <option key={u.unit} value={u.unit}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              {d.input.options.unit === 'custom' && (
                <div className="field">
                  <label htmlFor="opt-suffix">사용자 단위 (10자 이하)</label>
                  <input id="opt-suffix" maxLength={10} value={d.input.options.unit_suffix} onChange={(e) => setOpt({ unit_suffix: e.target.value })} />
                </div>
              )}
              <div className="field">
                <label htmlFor="opt-dec">소수 자리</label>
                <select
                  id="opt-dec"
                  value={d.input.options.decimals ?? 'auto'}
                  onChange={(e) => setOpt({ decimals: e.target.value === 'auto' ? null : Number(e.target.value) })}
                >
                  <option value="auto">자동</option>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="opt-min">최소</label>
                  <input id="opt-min" inputMode="decimal" placeholder="자동" value={d.min} onChange={(e) => setDraft({ ...d, min: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="opt-max">최대</label>
                  <input id="opt-max" inputMode="decimal" placeholder="자동" value={d.max} onChange={(e) => setDraft({ ...d, max: e.target.value })} />
                </div>
              </div>
              <ErrorMessage message={fieldErrors.minmax ?? fieldErrors.options} />
              {showReduce && (
                <div className="field">
                  <label htmlFor="opt-reduce">계산 (대표값)</label>
                  <select id="opt-reduce" value={d.input.options.reduce} onChange={(e) => setOpt({ reduce: e.target.value as Reducer })}>
                    {REDUCERS.map((r) => (
                      <option key={r.reducer} value={r.reducer}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <span className="label-like" id="opt-color-label">기본 색</span>
                <div className="swatches" role="radiogroup" aria-labelledby="opt-color-label">
                  {COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={d.input.options.color === c.name}
                      aria-label={c.label}
                      title={c.label}
                      className={d.input.options.color === c.name ? 'swatch active' : 'swatch'}
                      style={{ background: c.css }}
                      onClick={() => setOpt({ color: c.name })}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="opt-group">
              <h2>임계값</h2>
              <p className="hint">값이 기준 이상이면 그 색으로 표시합니다.</p>
              <ul className="thresholds">
                {d.thresholds.map((t, i) => (
                  <li key={t.key}>
                    <span className="th-dot" style={{ background: colorCss(t.color) }} aria-hidden="true" />
                    <input
                      aria-label={`${i + 1}번째 임계값 기준`}
                      inputMode="decimal"
                      value={t.value}
                      aria-invalid={num(t.value) === null ? true : undefined}
                      onChange={(e) => setDraft({ ...d, thresholds: d.thresholds.map((x) => (x.key === t.key ? { ...x, value: e.target.value } : x)) })}
                    />
                    <select
                      aria-label={`${i + 1}번째 임계값 색`}
                      value={t.color}
                      onChange={(e) => setDraft({ ...d, thresholds: d.thresholds.map((x) => (x.key === t.key ? { ...x, color: e.target.value as ColorName } : x)) })}
                    >
                      {COLORS.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${i + 1}번째 임계값 삭제`}
                      onClick={() => setDraft({ ...d, thresholds: d.thresholds.filter((x) => x.key !== t.key) })}
                    >
                      ✕
                    </button>
                  </li>
                ))}
                <li className="th-base">
                  <span className="th-dot" style={{ background: colorCss(d.input.options.color) }} aria-hidden="true" />
                  <span>기본 (그 외)</span>
                </li>
              </ul>
              <ErrorMessage message={fieldErrors.thresholds} />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={d.thresholds.length >= 10}
                onClick={() => {
                  const top = Math.max(0, ...d.thresholds.map((t) => num(t.value) ?? 0));
                  setDraft({ ...d, thresholds: [...d.thresholds, { key: nextKey(), value: String(top + 10), color: 'orange' }] });
                }}
              >
                + 임계값 추가
              </button>
            </section>
          </aside>
        </div>
      </form>
    </section>
  );
}
