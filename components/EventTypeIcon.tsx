import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { EventTypeId, SpontaneousTemplate } from '@/types/event';

export type Shape =
  | { type: 'path'; d: string }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number; ry?: number };

/**
 * Line icons for the event types, replacing the emoji. Geometry is from
 * Lucide (ISC license, https://lucide.dev) — the same set povestea-web uses
 * through lucide-react — so app and web show identical icons:
 * gem, baby, cake, hand-heart, building, flower, sparkles, zap.
 */
const ICONS: Record<EventTypeId, readonly Shape[]> = {
  wedding: [
    { type: 'path', d: 'M10.5 3 8 9l4 13 4-13-2.5-6' },
    { type: 'path', d: 'M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z' },
    { type: 'path', d: 'M2 9h20' },
  ],
  baptism: [
    { type: 'path', d: 'M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5' },
    { type: 'path', d: 'M15 12h.01' },
    { type: 'path', d: 'M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1' },
    { type: 'path', d: 'M9 12h.01' },
  ],
  birthday: [
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
  cause: [
    { type: 'path', d: 'M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16' },
    { type: 'path', d: 'm14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95' },
    { type: 'path', d: 'm2 15 6 6' },
    { type: 'path', d: 'm7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91' },
  ],
  corporate: [
    { type: 'path', d: 'M12 10h.01' },
    { type: 'path', d: 'M12 14h.01' },
    { type: 'path', d: 'M12 6h.01' },
    { type: 'path', d: 'M16 10h.01' },
    { type: 'path', d: 'M16 14h.01' },
    { type: 'path', d: 'M16 6h.01' },
    { type: 'path', d: 'M8 10h.01' },
    { type: 'path', d: 'M8 14h.01' },
    { type: 'path', d: 'M8 6h.01' },
    { type: 'path', d: 'M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3' },
    { type: 'rect', x: 4, y: 2, width: 16, height: 20, rx: 2 },
  ],
  memorial: [
    { type: 'circle', cx: 12, cy: 12, r: 3 },
    { type: 'path', d: 'M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5' },
    { type: 'path', d: 'M12 7.5V9' },
    { type: 'path', d: 'M7.5 12H9' },
    { type: 'path', d: 'M16.5 12H15' },
    { type: 'path', d: 'M12 16.5V15' },
    { type: 'path', d: 'm8 8 1.88 1.88' },
    { type: 'path', d: 'M14.12 9.88 16 8' },
    { type: 'path', d: 'm8 16 1.88-1.88' },
    { type: 'path', d: 'M14.12 14.12 16 16' },
  ],
  other: [
    { type: 'path', d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' },
    { type: 'path', d: 'M20 2v4' },
    { type: 'path', d: 'M22 4h-4' },
    { type: 'circle', cx: 4, cy: 20, r: 2 },
  ],
  spontaneous: [
    { type: 'path', d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z' },
  ],
};

export function EventTypeIcon({
  type,
  size = 22,
  color,
  strokeWidth = 1.8,
}: {
  type: EventTypeId | null;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return <LineIcon shapes={ICONS[type ?? 'other'] ?? ICONS.other} size={size} color={color} strokeWidth={strokeWidth} />;
}

/** Draws Lucide-style line geometry (24x24, round caps). Shared with MomentIcon. */
export function LineIcon({
  shapes,
  size = 22,
  color,
  strokeWidth = 1.8,
}: {
  shapes: readonly Shape[];
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes.map((shape, index) =>
        shape.type === 'path' ? (
          <Path key={index} d={shape.d} />
        ) : shape.type === 'circle' ? (
          <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ) : (
          <Rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            rx={shape.rx}
            ry={shape.ry}
          />
        ),
      )}
    </Svg>
  );
}

/** Spontaneous templates, same Lucide set: mic, party-popper, wine. */
const TEMPLATE_ICONS: Record<SpontaneousTemplate, readonly Shape[]> = {
  karaoke: [
    { type: 'path', d: 'M12 19v3' },
    { type: 'path', d: 'M19 10v2a7 7 0 0 1-14 0v-2' },
    { type: 'rect', x: 9, y: 2, width: 6, height: 13, rx: 3 },
  ],
  party: [
    { type: 'path', d: 'M5.8 11.3 2 22l10.7-3.79' },
    { type: 'path', d: 'M4 3h.01' },
    { type: 'path', d: 'M22 8h.01' },
    { type: 'path', d: 'M15 2h.01' },
    { type: 'path', d: 'M22 20h.01' },
    { type: 'path', d: 'm22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10' },
    { type: 'path', d: 'm22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17' },
    { type: 'path', d: 'm11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7' },
    { type: 'path', d: 'M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z' },
  ],
  tasting: [
    { type: 'path', d: 'M8 22h8' },
    { type: 'path', d: 'M7 10h10' },
    { type: 'path', d: 'M12 15v7' },
    { type: 'path', d: 'M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z' },
  ],
};

export function TemplateIcon({
  template,
  size = 22,
  color,
  strokeWidth = 1.8,
}: {
  template: SpontaneousTemplate;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return <LineIcon shapes={TEMPLATE_ICONS[template]} size={size} color={color} strokeWidth={strokeWidth} />;
}
