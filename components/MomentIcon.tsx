import { LineIcon, type Shape } from '@/components/EventTypeIcon';

/**
 * Icons an organizer can tag a moment with (moments.icon). Same line style as
 * the event-type icons; geometry from Lucide (ISC, https://lucide.dev) except
 * `rings`, drawn here in the same style. Keep ids in sync with the check in
 * 20261007000001_moment_icon.sql.
 */
export const MOMENT_ICONS = {
  rings: [
    { type: 'circle', cx: 9, cy: 14.5, r: 5.5 },
    { type: 'circle', cx: 15, cy: 14.5, r: 5.5 },
    { type: 'path', d: 'M10.5 3h3l1.5 2-3 2.5L9 5z' },
  ],
  cake: [
    { type: 'path', d: 'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8' },
    { type: 'path', d: 'M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1' },
    { type: 'path', d: 'M2 21h20' },
    { type: 'path', d: 'M7 8v3' },
    { type: 'path', d: 'M12 8v3' },
    { type: 'path', d: 'M17 8v3' },
    { type: 'path', d: 'M7 4h.01' },
    { type: 'path', d: 'M12 4h.01' },
    { type: 'path', d: 'M17 4h.01' },
  ],
  camera: [
    { type: 'path', d: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z' },
    { type: 'circle', cx: 12, cy: 13, r: 3 },
  ],
  glasses: [
    { type: 'path', d: 'M8 22h8' },
    { type: 'path', d: 'M7 10h10' },
    { type: 'path', d: 'M12 15v7' },
    { type: 'path', d: 'M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z' },
  ],
  music: [
    { type: 'path', d: 'M9 18V5l12-2v13' },
    { type: 'circle', cx: 6, cy: 18, r: 3 },
    { type: 'circle', cx: 18, cy: 16, r: 3 },
  ],
  food: [
    { type: 'path', d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' },
    { type: 'path', d: 'M7 2v20' },
    { type: 'path', d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' },
  ],
  flower: [
    { type: 'circle', cx: 12, cy: 12, r: 3 },
    { type: 'path', d: 'M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5' },
  ],
  location: [
    { type: 'path', d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0' },
    { type: 'circle', cx: 12, cy: 10, r: 3 },
  ],
  gift: [
    { type: 'rect', x: 3, y: 8, width: 18, height: 4, rx: 1 },
    { type: 'path', d: 'M12 8v13' },
    { type: 'path', d: 'M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7' },
    { type: 'path', d: 'M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5' },
  ],
  heart: [
    { type: 'path', d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' },
  ],
  baby: [
    { type: 'path', d: 'M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5' },
    { type: 'path', d: 'M15 12h.01' },
    { type: 'path', d: 'M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1' },
    { type: 'path', d: 'M9 12h.01' },
  ],
  sparkles: [
    { type: 'path', d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' },
    { type: 'path', d: 'M20 2v4' },
    { type: 'path', d: 'M22 4h-4' },
  ],
} as const satisfies Record<string, readonly Shape[]>;

export type MomentIconId = keyof typeof MOMENT_ICONS;

export function isMomentIconId(value: string | null | undefined): value is MomentIconId {
  return value != null && Object.prototype.hasOwnProperty.call(MOMENT_ICONS, value);
}

export function MomentIcon({ icon, size = 22, color }: { icon: MomentIconId; size?: number; color: string }) {
  return <LineIcon shapes={MOMENT_ICONS[icon]} size={size} color={color} />;
}
