// 대시보드 API: 패널 타입 정의 + 호출 함수 (패널은 로그인한 사용자별)
import { request } from './client';

export type VizType = 'stat' | 'timeseries' | 'bar' | 'gauge' | 'table';
export type PanelSource = 'manual' | 'function';
export type Unit = 'none' | 'percent' | 'ms' | 's' | 'bytes' | 'count' | 'krw' | 'custom';
export type ColorName = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
export type Reducer = 'last' | 'first' | 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface ValueRow {
  label: string;
  value: number;
}

export interface Threshold {
  value: number;
  color: ColorName;
}

export interface PanelOptions {
  unit: Unit;
  unit_suffix: string;
  decimals: number | null;
  min: number | null;
  max: number | null;
  reduce: Reducer;
  color: ColorName;
  thresholds: Threshold[];
}

export interface Panel {
  id: number;
  title: string;
  description: string;
  viz_type: VizType;
  source: PanelSource;
  values: ValueRow[];
  func_expr: string;
  func_from: number;
  func_to: number;
  func_step: number;
  formula: string;
  options: PanelOptions;
  width: number;
  height: number;
  position: number;
  created_at: string;
  updated_at: string;
}

// 생성·수정 시 보내는 항목 (id·position·시각은 서버가 정함)
export type PanelInput = Omit<Panel, 'id' | 'position' | 'created_at' | 'updated_at'>;

const BASE = '/api/dashboard/panels/';

export function listPanels(): Promise<Panel[]> {
  return request<Panel[]>('GET', BASE);
}

export function getPanel(id: number): Promise<Panel> {
  return request<Panel>('GET', `${BASE}${id}/`);
}

export function createPanel(body: PanelInput): Promise<Panel> {
  return request<Panel>('POST', BASE, body);
}

export function updatePanel(id: number, body: Partial<PanelInput>): Promise<Panel> {
  return request<Panel>('PATCH', `${BASE}${id}/`, body);
}

export function deletePanel(id: number): Promise<void> {
  return request<void>('DELETE', `${BASE}${id}/`);
}

export function reorderPanels(ids: number[]): Promise<Panel[]> {
  return request<Panel[]>('POST', `${BASE}reorder/`, { ids });
}
