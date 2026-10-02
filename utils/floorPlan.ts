import type { SeatingTable, TableShape } from '@/types/guest';

/** Grid used for tables without a saved position. Must match the backfill in
 * supabase/migrations/20261001000004_seating_floor_plan.sql. */
const GRID_COLUMNS = 3;
const GRID_GAP = 170;
const GRID_ORIGIN = 110;

/** Floor-plan bounds (units = dp at zoom 1x). Positions are clamped inside. */
export const PLAN_MIN = 50;
export const PLAN_MAX = 2400;

export function gridSlot(index: number): { x: number; y: number } {
  return {
    x: GRID_ORIGIN + (index % GRID_COLUMNS) * GRID_GAP,
    y: GRID_ORIGIN + Math.floor(index / GRID_COLUMNS) * GRID_GAP,
  };
}

/** Saved position, or the grid slot for its place in the list. */
export function tablePosition(table: SeatingTable, index: number): { x: number; y: number } {
  if (table.pos_x !== null && table.pos_y !== null) return { x: table.pos_x, y: table.pos_y };
  return gridSlot(index);
}

export function tableSize(shape: TableShape): { width: number; height: number } {
  return shape === 'rect' ? { width: 128, height: 64 } : { width: 88, height: 88 };
}

/** Chair dots around a table, as offsets from the table's top-left corner. */
export function chairOffsets(shape: TableShape, seats: number): { x: number; y: number }[] {
  const count = Math.min(Math.max(seats, 0), 20);
  const { width, height } = tableSize(shape);
  const gap = 11;
  if (count === 0) return [];

  if (shape === 'round') {
    const radius = width / 2 + gap;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      return { x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius };
    });
  }

  // Rect: split between the two long sides, top gets the extra one.
  const top = Math.ceil(count / 2);
  const bottom = count - top;
  const row = (n: number, y: number) =>
    Array.from({ length: n }, (_, i) => ({ x: ((i + 1) * width) / (n + 1), y }));
  return [...row(top, -gap), ...row(bottom, height + gap)];
}

export function clampPlan(value: number): number {
  return Math.min(PLAN_MAX, Math.max(PLAN_MIN, Math.round(value)));
}
