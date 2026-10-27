import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import { harmonizeCoverTheme, type CoverDecoration, type CoverTheme } from '@/utils/coverThemes';

/** Every cover is drawn in this box and cropped to fill (slice), so any size works. */
const W = 160;
const H = 100;

/** A cover theme drawn in code: gradient, two glows, one decoration, tuned to the app theme. Static. */
export function CoverArt({
  theme: picked,
  plain = false,
  style,
  children,
}: {
  theme: CoverTheme;
  /** Gradient and glows only: the decoration is cropped into a smudge at thumbnail size. */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { tokens, themeId } = useTheme();
  // The app-themed defaults are already in the app's colors.
  const theme = picked.id.startsWith('default-') ? picked : harmonizeCoverTheme(picked, tokens);
  const gradientId = `bg-${theme.id}-${themeId}`;
  return (
    <View style={[styles.root, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.colors[0]} />
            <Stop offset="0.55" stopColor={theme.colors[1]} />
            <Stop offset="1" stopColor={theme.colors[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill={`url(#${gradientId})`} />
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
          <Defs>
            {theme.glows.map(([color], index) => (
              <RadialGradient key={index} id={`glow-${theme.id}-${index}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={color} stopOpacity={0.75} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {theme.glows.map(([, x, y], index) => (
            <Circle key={index} cx={x * W} cy={y * H} r={52} fill={`url(#glow-${theme.id}-${index})`} />
          ))}
        </Svg>
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
          {plain ? null : <Decoration kind={theme.decoration} ink={theme.ink} />}
        </Svg>
      </View>

      {children}
    </View>
  );
}

function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const k = r * 0.22;
  return (
    <Path
      d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`}
      fill={fill}
    />
  );
}

function Decoration({ kind, ink }: { kind: CoverDecoration; ink: string }) {
  const stroke = { stroke: ink, fill: 'none', strokeLinecap: 'round' as const };
  switch (kind) {
    case 'rings':
      return (
        <G opacity={0.6}>
          {[10, 18, 26, 34].map((r) => (
            <Circle key={r} cx={120} cy={35} r={r} {...stroke} strokeWidth={0.6} />
          ))}
          <Circle cx={120} cy={35} r={4} fill={ink} />
        </G>
      );
    case 'confetti':
      return (
        <G opacity={0.85}>
          {[
            [20, 18, '#FFD166'], [42, 30, ink], [70, 14, '#FF8FB5'], [105, 26, '#FFD166'],
            [130, 12, ink], [145, 36, '#FF8FB5'], [30, 50, '#FF8FB5'], [118, 52, ink],
          ].map(([x, y, c], i) => (
            <Rect key={i} x={x as number} y={y as number} width={4} height={1.6} rx={0.8} fill={c as string} transform={`rotate(${i * 37} ${x} ${y})`} />
          ))}
        </G>
      );
    case 'sparkles':
      return (
        <G>
          <Sparkle x={128} y={30} r={11} fill={ink} />
          <Sparkle x={38} y={62} r={7} fill={ink} />
          <Path d="M96 16v8M92 20h8M140 64v6M137 67h6" stroke={ink} strokeWidth={1} opacity={0.5} />
        </G>
      );
    case 'bars':
      return (
        <G>
          {[22, 34, 16, 40, 28, 12].map((h, i) => (
            <Rect key={i} x={112 + i * 7} y={78 - h} width={3.5} height={h} rx={1.5} fill={ink} opacity={0.8} />
          ))}
        </G>
      );
    case 'disco':
      return (
        <G>
          {[0, 1, 2, 3, 4].map((i) => (
            <Line key={i} x1={110} y1={34} x2={30 + i * 14} y2={100} stroke={ink} strokeWidth={0.5} opacity={0.35} />
          ))}
          <Circle cx={110} cy={34} r={14} fill="#D9D4F5" opacity={0.9} />
          <Path d="M96 34h28M110 20v28M100 26h20M100 42h20M103 21v26M117 21v26" stroke="#8C84C8" strokeWidth={0.6} />
          <Sparkle x={24} y={22} r={5} fill={ink} />
        </G>
      );
    case 'neon':
      return (
        <G>
          <Rect x={104} y={14} width={44} height={22} rx={11} {...stroke} strokeWidth={1.6} />
          <Path d="M20 78 Q32 66 44 78 T68 78 T92 78" stroke="#D07CFF" strokeWidth={1.6} fill="none" />
        </G>
      );
    case 'fireworks':
      return (
        <G>
          {[[40, 26, 12], [118, 20, 14], [86, 48, 6]].map(([cx, cy, r], i) => (
            <G key={i}>
              {Array.from({ length: 12 }, (_, k) => {
                const a = (k / 12) * Math.PI * 2;
                return (
                  <Line
                    key={k}
                    x1={cx! + Math.cos(a) * r! * 0.35}
                    y1={cy! + Math.sin(a) * r! * 0.35}
                    x2={cx! + Math.cos(a) * r!}
                    y2={cy! + Math.sin(a) * r!}
                    stroke={i === 2 ? '#FF7FB0' : ink}
                    strokeWidth={0.7}
                  />
                );
              })}
            </G>
          ))}
        </G>
      );
    case 'tree':
      return (
        <G>
          <Path d="M128 18 L144 46 H136 L148 66 H108 L120 46 H112 Z" {...stroke} strokeWidth={1} />
          {[[30, 20], [56, 40], [20, 60], [80, 18], [92, 62]].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={1.3} fill={ink} />
          ))}
        </G>
      );
    case 'moon':
      return (
        <G>
          <Circle cx={118} cy={30} r={14} fill={ink} />
          <Circle cx={124} cy={26} r={12} fill="#2B1638" opacity={0.55} />
        </G>
      );
    case 'hearts':
      return (
        <G opacity={0.7}>
          <Circle cx={68} cy={50} r={20} {...stroke} strokeWidth={0.9} />
          <Circle cx={92} cy={50} r={20} {...stroke} strokeWidth={0.9} />
        </G>
      );
    case 'gold':
      return (
        <G>
          <Line x1={0} y1={18} x2={W} y2={18} stroke={ink} strokeWidth={0.4} opacity={0.6} />
          <Line x1={0} y1={84} x2={W} y2={84} stroke={ink} strokeWidth={0.4} opacity={0.6} />
          <Line x1={0} y1={87} x2={W} y2={87} stroke={ink} strokeWidth={0.4} opacity={0.4} />
          <Path d="M80 10 l3 3 -3 3 -3 -3 Z" fill={ink} />
        </G>
      );
    case 'crescent':
      return (
        <G>
          <Path d="M130 16 A16 16 0 1 0 146 40 A12 12 0 1 1 130 16 Z" {...stroke} strokeWidth={1} />
          <Circle cx={40} cy={30} r={1.2} fill={ink} />
          <Circle cx={70} cy={56} r={1} fill={ink} />
        </G>
      );
    case 'balloons':
      return (
        <G opacity={0.9}>
          <Circle cx={120} cy={30} r={9} fill="#FFC0D4" />
          <Circle cx={136} cy={40} r={8} fill="#B9E3FF" />
          <Path d="M120 39 Q118 55 122 70 M136 48 Q138 60 132 72" stroke={ink} strokeWidth={0.6} fill="none" />
        </G>
      );
    case 'leaf':
      return (
        <G>
          <Path d="M118 70 Q120 36 146 22 Q144 56 118 70 Z" {...stroke} strokeWidth={1} />
          <Path d="M118 70 Q130 48 146 22" {...stroke} strokeWidth={0.6} />
        </G>
      );
    case 'sun':
      return (
        <G>
          <Circle cx={80} cy={54} r={14} fill="#FFF3DA" />
          <Rect x={0} y={62} width={W} height={38} fill="#1E6A86" opacity={0.85} />
          <Path d="M0 72 Q20 68 40 72 T80 72 T120 72 T160 72 M0 84 Q20 80 40 84 T80 84 T120 84 T160 84" stroke={ink} strokeWidth={0.6} fill="none" opacity={0.6} />
        </G>
      );
    case 'aurora':
      return (
        <G opacity={0.55}>
          <Path d="M0 40 Q40 10 80 34 T160 20" stroke="#3FE0B0" strokeWidth={8} fill="none" />
          <Path d="M0 56 Q50 30 90 50 T160 40" stroke="#8E5CFF" strokeWidth={6} fill="none" />
        </G>
      );
    case 'grid':
      return (
        <G opacity={0.5}>
          {[20, 40, 60, 80, 100, 120, 140].map((x) => (
            <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={ink} strokeWidth={0.3} />
          ))}
          {[20, 40, 60, 80].map((y) => (
            <Line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={ink} strokeWidth={0.3} />
          ))}
          <Path d="M10 80 L50 58 L80 68 L120 36 L150 44" stroke="#FFFFFF" strokeWidth={1.2} fill="none" />
        </G>
      );
    case 'cap':
      return (
        <G>
          <Path d="M120 22 L146 32 L120 42 L94 32 Z" fill={ink} />
          <Path d="M106 37 V48 Q120 56 134 48 V37" fill={ink} opacity={0.85} />
          <Line x1={146} y1={32} x2={146} y2={48} stroke={ink} strokeWidth={1} />
        </G>
      );
    case 'plate':
      return (
        <G opacity={0.6}>
          <Circle cx={124} cy={34} r={18} {...stroke} strokeWidth={0.9} />
          <Circle cx={124} cy={34} r={12} {...stroke} strokeWidth={0.6} />
          <Path d="M18 70 Q60 60 100 78" {...stroke} strokeWidth={0.6} />
        </G>
      );
    case 'line':
      return (
        <G>
          <Circle cx={124} cy={30} r={14} {...stroke} strokeWidth={0.8} />
          <Line x1={24} y1={70} x2={70} y2={70} stroke={ink} strokeWidth={0.8} />
        </G>
      );
  }
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
});
