// 대시보드 위의 패널 한 칸.
// - 머리글: 제목, 설명, 시각화 유형 바로 바꾸기(편집기 없이), 패널 메뉴
// - 오른쪽 아래 손잡이: 마우스로 끌거나, 포커스 후 방향키로 크기 조정(편집기 없이)
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Panel, VizType } from '../api/dashboard';
import { GRID_COLUMNS, GRID_GAP_PX, GRID_ROW_PX, PANEL_MAX_H, PANEL_MAX_W, PANEL_MIN_H, PANEL_MIN_W, VIZ_TYPES } from './data';
import Menu from './Menu';
import PanelViz from './viz/PanelViz';

interface Props {
  panel: Panel;
  stacked: boolean; // 좁은 화면: 패널이 한 줄 전체를 쓰고 높이만 바뀐다
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onResize: (w: number, h: number) => void; // 끄는 동안 미리보기
  onResizeEnd: () => void; // 놓았을 때 저장
  onVizChange: (viz: VizType) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function PanelCard(props: Props) {
  const { panel, stacked } = props;
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  // 누른 순간의 포인터 위치·크기. 끄는 동안 격자가 다시 배치돼 패널이 움직여도 이동량으로만 계산한다.
  const start = useRef<{ x: number; y: number; w: number; h: number; colW: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const viz = VIZ_TYPES.find((v) => v.type === panel.viz_type) ?? VIZ_TYPES[0];

  function sizeFromPointer(e: PointerEvent<HTMLElement>) {
    const s = start.current;
    if (!s) return;
    const w = stacked ? s.w : s.w + Math.round((e.clientX - s.x) / (s.colW + GRID_GAP_PX));
    const h = s.h + Math.round((e.clientY - s.y) / (GRID_ROW_PX + GRID_GAP_PX));
    const nw = clamp(w, PANEL_MIN_W, PANEL_MAX_W);
    const nh = clamp(h, PANEL_MIN_H, PANEL_MAX_H);
    if (nw !== panel.width || nh !== panel.height) props.onResize(nw, nh);
  }

  function onHandleDown(e: PointerEvent<HTMLButtonElement>) {
    const grid = ref.current?.parentElement;
    if (!grid) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const colW = (grid.clientWidth - GRID_GAP_PX * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    start.current = { x: e.clientX, y: e.clientY, w: panel.width, h: panel.height, colW };
    setResizing(true);
  }

  function onHandleUp(e: PointerEvent<HTMLButtonElement>) {
    if (!start.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    start.current = null;
    setResizing(false);
    props.onResizeEnd();
  }

  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>) {
    let w = panel.width;
    let h = panel.height;
    if (e.key === 'ArrowLeft' && !stacked) w--;
    else if (e.key === 'ArrowRight' && !stacked) w++;
    else if (e.key === 'ArrowUp') h--;
    else if (e.key === 'ArrowDown') h++;
    else return;
    e.preventDefault();
    w = clamp(w, PANEL_MIN_W, PANEL_MAX_W);
    h = clamp(h, PANEL_MIN_H, PANEL_MAX_H);
    if (w !== panel.width || h !== panel.height) {
      props.onResize(w, h);
      props.onResizeEnd();
    }
  }

  return (
    <section
      ref={ref}
      className={`dash-panel${resizing ? ' resizing' : ''}`}
      style={{ ['--w' as string]: panel.width, ['--h' as string]: panel.height }}
      aria-labelledby={titleId}
      data-panel-id={panel.id}
    >
      <header className="dash-panel-head">
        <h2 id={titleId} className="dash-panel-title" title={panel.title}>
          {panel.title}
        </h2>
        {panel.description && (
          <span className="dash-panel-desc" title={panel.description} aria-label={`설명: ${panel.description}`} role="img">
            ⓘ
          </span>
        )}
        <div className="dash-panel-tools">
          <Menu
            buttonClassName="viz-switch"
            buttonAriaLabel={`시각화 유형 바꾸기 (현재 ${viz.label})`}
            buttonLabel={
              <>
                <span aria-hidden="true">{viz.icon}</span>
                <span className="viz-switch-label">{viz.label}</span>
                <span aria-hidden="true" className="caret">▾</span>
              </>
            }
            items={VIZ_TYPES.map((v) => ({
              key: v.type,
              checked: v.type === panel.viz_type,
              label: (
                <>
                  <span aria-hidden="true" className="menu-ico">{v.icon}</span>
                  {v.label}
                </>
              ),
              onSelect: () => v.type !== panel.viz_type && props.onVizChange(v.type),
            }))}
          />
          <Menu
            buttonAriaLabel={`${panel.title} 패널 메뉴`}
            buttonLabel={<span aria-hidden="true">⋮</span>}
            items={[
              { key: 'edit', label: '✎ 편집', onSelect: props.onEdit },
              { key: 'dup', label: '⧉ 복제', onSelect: props.onDuplicate, disabled: props.busy },
              { key: 'up', label: '← 앞으로 이동', onSelect: () => props.onMove(-1), disabled: props.isFirst || props.busy },
              { key: 'down', label: '→ 뒤로 이동', onSelect: () => props.onMove(1), disabled: props.isLast || props.busy },
              { key: 'del', label: '🗑 삭제', onSelect: props.onDelete, danger: true, disabled: props.busy },
            ]}
          />
        </div>
      </header>

      <div className="dash-panel-body">
        <PanelViz panel={panel} />
      </div>

      {resizing && (
        <span className="dash-size-badge" aria-hidden="true">
          {stacked ? `높이 ${panel.height}` : `${panel.width} × ${panel.height}`}
        </span>
      )}
      <button
        type="button"
        className="dash-resize"
        aria-label={`${panel.title} 크기 조정: 현재 너비 ${panel.width}/24칸, 높이 ${panel.height}칸. ${stacked ? '위아래' : '방향키'}로 조정`}
        title="끌어서 크기 조정 (포커스 후 방향키도 가능)"
        onPointerDown={onHandleDown}
        onPointerMove={sizeFromPointer}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onKeyDown={onHandleKey}
      />
    </section>
  );
}
