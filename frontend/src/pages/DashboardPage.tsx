import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPanel,
  deletePanel,
  listPanels,
  reorderPanels,
  updatePanel,
  type Panel,
  type PanelInput,
  type VizType,
} from '../api/dashboard';
import { ApiError, MSG_SERVER } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import PanelCard from '../dashboard/PanelCard';
import { DEFAULT_OPTIONS, newPanelInput, toInput } from '../dashboard/data';
import { useElementSize } from '../dashboard/useElementSize';

interface Props {
  onAddPanel: () => void;
  onEditPanel: (id: number) => void;
}

// 이 폭보다 좁으면 패널을 한 줄에 하나씩 쌓는다(너비 조정 대신 높이만 조정).
const STACK_BELOW_PX = 640;
const SAVE_DELAY_MS = 400;

// 처음 써 보는 사람을 위한 예시 패널
function samplePanels(): PanelInput[] {
  const base = newPanelInput();
  return [
    {
      ...base,
      title: 'CPU 사용률',
      description: '직접 입력한 값의 마지막 값을 표시합니다.',
      viz_type: 'stat',
      values: [40, 52, 47, 63, 58, 71, 66].map((v, i) => ({ label: `${i + 1}시`, value: v })),
      options: { ...DEFAULT_OPTIONS, unit: 'percent', color: 'green', thresholds: [{ value: 60, color: 'orange' }, { value: 80, color: 'red' }] },
      width: 6,
      height: 6,
    },
    {
      ...base,
      title: '응답 시간 (함수식)',
      description: '함수식 sin(t)*40+120 으로 만든 값입니다.',
      viz_type: 'timeseries',
      source: 'function',
      func_expr: 'sin(t) * 40 + 120',
      func_from: 0,
      func_to: 12,
      func_step: 0.25,
      options: { ...DEFAULT_OPTIONS, unit: 'ms', thresholds: [{ value: 150, color: 'orange' }] },
      width: 18,
      height: 6,
    },
    {
      ...base,
      title: '요일별 처리 건수',
      description: '변환 수식 x * 1.1 (10% 가산)을 적용합니다.',
      viz_type: 'bar',
      values: ['월', '화', '수', '목', '금', '토', '일'].map((d, i) => ({ label: d, value: [120, 135, 128, 150, 162, 80, 64][i] })),
      formula: 'x * 1.1',
      options: { ...DEFAULT_OPTIONS, unit: 'count', color: 'purple' },
      width: 12,
      height: 8,
    },
    {
      ...base,
      title: '디스크 사용량',
      description: '사용량을 전체 용량 대비 비율로 바꿉니다: x / 500 * 100',
      viz_type: 'gauge',
      values: [{ label: '현재', value: 372 }],
      formula: 'x / 500 * 100',
      options: { ...DEFAULT_OPTIONS, unit: 'percent', decimals: 1, min: 0, max: 100, thresholds: [{ value: 70, color: 'orange' }, { value: 90, color: 'red' }] },
      width: 12,
      height: 8,
    },
  ];
}

export default function DashboardPage({ onAddPanel, onEditPanel }: Props) {
  const { handleAuthError } = useAuth();
  const [panels, setPanels] = useState<Panel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(0);
  const [wrapRef, wrapSize] = useElementSize<HTMLDivElement>();
  const stacked = wrapSize.width > 0 && wrapSize.width < STACK_BELOW_PX;

  // 지연 저장이 최신 크기를 읽도록 ref에도 둔다.
  const panelsRef = useRef<Panel[] | null>(null);
  panelsRef.current = panels;
  const timers = useRef(new Map<number, number>());

  const fail = useCallback(
    (err: unknown) => {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : MSG_SERVER);
    },
    [handleAuthError],
  );

  const load = useCallback(
    async (isActive: () => boolean) => {
      try {
        const data = await listPanels();
        if (isActive()) setPanels(data);
      } catch (err) {
        if (isActive()) fail(err);
      }
    },
    [fail],
  );

  useEffect(() => {
    let active = true;
    void load(() => active);
    const pending = timers.current;
    return () => {
      active = false;
      // 화면을 떠날 때 기다리던 크기 저장은 바로 보낸다(결과는 화면이 없으니 무시).
      pending.forEach((t, id) => {
        window.clearTimeout(t);
        const p = panelsRef.current?.find((x) => x.id === id);
        if (p) void updatePanel(id, { width: p.width, height: p.height }).catch(() => undefined);
      });
      pending.clear();
    };
  }, [load]);

  async function track<T>(work: Promise<T>): Promise<T> {
    setSaving((n) => n + 1);
    try {
      return await work;
    } finally {
      setSaving((n) => n - 1);
    }
  }

  function patchLocal(id: number, patch: Partial<Panel>) {
    setPanels((prev) => (prev ? prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) : prev));
  }

  function onResize(id: number, width: number, height: number) {
    patchLocal(id, { width, height });
  }

  function onResizeEnd(id: number) {
    const old = timers.current.get(id);
    if (old) window.clearTimeout(old);
    timers.current.set(
      id,
      window.setTimeout(async () => {
        timers.current.delete(id);
        const p = panelsRef.current?.find((x) => x.id === id);
        if (!p) return;
        setError(null);
        try {
          await track(updatePanel(id, { width: p.width, height: p.height }));
        } catch (err) {
          fail(err);
        }
      }, SAVE_DELAY_MS),
    );
  }

  async function onVizChange(id: number, viz: VizType) {
    const before = panelsRef.current?.find((p) => p.id === id)?.viz_type;
    patchLocal(id, { viz_type: viz });
    setError(null);
    try {
      await track(updatePanel(id, { viz_type: viz }));
    } catch (err) {
      if (before) patchLocal(id, { viz_type: before });
      fail(err);
    }
  }

  async function saveOrder(next: Panel[]) {
    setPanels(next);
    try {
      setPanels(await track(reorderPanels(next.map((p) => p.id))));
    } catch (err) {
      fail(err);
    }
  }

  async function onMove(id: number, delta: -1 | 1) {
    const list = panelsRef.current;
    if (!list) return;
    const i = list.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setError(null);
    setBusy(true);
    await saveOrder(next);
    setBusy(false);
  }

  async function onDuplicate(id: number) {
    const list = panelsRef.current;
    const src = list?.find((p) => p.id === id);
    if (!list || !src) return;
    setError(null);
    setBusy(true);
    try {
      const copy = await track(createPanel({ ...toInput(src), title: `${src.title} (복사)`.slice(0, 100) }));
      const i = list.findIndex((p) => p.id === id);
      await saveOrder([...list.slice(0, i + 1), copy, ...list.slice(i + 1)]);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    const p = panelsRef.current?.find((x) => x.id === id);
    if (!p || !window.confirm(`'${p.title}' 패널을 삭제할까요?`)) return;
    setError(null);
    setBusy(true);
    try {
      await track(deletePanel(id));
      setPanels((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onCreateSamples() {
    setError(null);
    setBusy(true);
    try {
      const created: Panel[] = [];
      for (const s of samplePanels()) created.push(await track(createPanel(s)));
      setPanels((prev) => [...(prev ?? []), ...created]);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashboard">
      <header className="section-head">
        <div className="section-title">
          <div className="section-ico" aria-hidden="true">📊</div>
          <div>
            <h1>대시보드</h1>
            <p className="section-sub">Operations Dashboard · 직접 입력한 값으로 만드는 패널</p>
          </div>
        </div>
        <div className="section-actions">
          <span className="save-state" role="status">
            {saving > 0 ? '저장 중…' : ''}
          </span>
          {panels && (
            <span className="badge badge-count">
              패널 <strong>{panels.length}</strong>개
            </span>
          )}
          <button type="button" className="btn btn-primary" onClick={onAddPanel} disabled={busy}>
            + 패널 추가
          </button>
        </div>
      </header>

      <ErrorMessage message={error} />

      <div ref={wrapRef}>
        {panels === null && !error && (
          <p role="status" className="loading-inline">
            불러오는 중…
          </p>
        )}

        {panels !== null && panels.length === 0 && (
          <div className="coming-soon">
            <div className="cs-ico" aria-hidden="true">📊</div>
            <h2>아직 패널이 없습니다</h2>
            <p>값을 직접 입력하거나 함수식으로 데이터를 만들고, 수식으로 변환한 결과를 그래프로 볼 수 있습니다.</p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={onAddPanel} disabled={busy}>
                + 패널 추가
              </button>
              <button type="button" className="btn btn-secondary" onClick={onCreateSamples} disabled={busy}>
                {busy ? '만드는 중…' : '예시 패널 4개 만들기'}
              </button>
            </div>
          </div>
        )}

        {panels !== null && panels.length > 0 && (
          <>
            <p className="hint dash-hint">
              패널 오른쪽 아래 모서리를 끌거나 포커스 후 방향키로 크기를 바꾸고, 머리글의 유형 버튼으로 그래프 형태를 바로 바꿀 수 있습니다.
            </p>
            <div className={`dash-grid${stacked ? ' stacked' : ''}`}>
              {panels.map((p, i) => (
                <PanelCard
                  key={p.id}
                  panel={p}
                  stacked={stacked}
                  isFirst={i === 0}
                  isLast={i === panels.length - 1}
                  busy={busy}
                  onResize={(w, h) => onResize(p.id, w, h)}
                  onResizeEnd={() => onResizeEnd(p.id)}
                  onVizChange={(v) => void onVizChange(p.id, v)}
                  onEdit={() => onEditPanel(p.id)}
                  onDuplicate={() => void onDuplicate(p.id)}
                  onMove={(d) => void onMove(p.id, d)}
                  onDelete={() => void onDelete(p.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
