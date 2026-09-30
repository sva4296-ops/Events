import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import { brandGradient } from '@/utils/themeTokens';

/** Design box the node coordinates below were drawn in. */
const BOX_W = 342;
const BOX_H = 300;

const NODES = [
  { x: 40, y: 200 },
  { x: 130, y: 128 },
  { x: 220, y: 192 },
  { x: 304, y: 110 },
] as const;

/** The thread up to each node — index i is the path from the first node to node i. */
const THREAD = [
  '',
  'M40 200C80 200 90 128 130 128',
  'M40 200C80 200 90 128 130 128S180 192 220 192',
  'M40 200C80 200 90 128 130 128S180 192 220 192S264 110 304 110',
] as const;

const ICONS = ['send', 'heart', 'radio', 'image'] as const;

interface StoryStagesProps {
  /** 0-based stage currently highlighted. */
  current: number;
  labels: readonly [string, string, string, string];
  width: number;
}

/**
 * Warm Story 2.0 onboarding illustration: the four stages of an event
 * (Lansarea → Parcursul → Ziua X → Recap) on a dotted thread, the current
 * one large with its icon, earlier ones checked, later ones outlined.
 */
export function StoryStages({ current, labels, width }: StoryStagesProps) {
  const { tokens } = useTheme();
  const gradientId = `stages-${useId()}`;
  const scale = width / BOX_W;
  const height = BOX_H * scale;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${BOX_W} ${BOX_H}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={brandGradient[0]} />
            <Stop offset="0.5" stopColor={brandGradient[1]} />
            <Stop offset="1" stopColor={brandGradient[2]} />
          </SvgGradient>
        </Defs>
        <Path
          d={THREAD[3]}
          stroke={tokens.border}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="2 8"
          fill="none"
        />
        {current > 0 ? (
          <Path
            d={THREAD[current]}
            stroke={`url(#${gradientId})`}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>

      {NODES.map((node, index) => {
        const cx = node.x * scale;
        const cy = node.y * scale;
        const isCurrent = index === current;
        const isDone = index < current;
        const size = isCurrent ? 88 : isDone ? 24 : 20;
        const labelTop = cy + (isCurrent ? 54 : isDone ? 20 : 20);

        return (
          <View key={index} pointerEvents="none">
            {isCurrent ? (
              <View
                style={[
                  styles.halo,
                  { left: cx - 54, top: cy - 54, backgroundColor: tokens.accentTint },
                ]}
              >
                <LinearGradient
                  colors={brandGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.big}
                >
                  <Feather name={ICONS[index] ?? 'star'} size={36} color="#FFFFFF" />
                </LinearGradient>
              </View>
            ) : (
              <View
                style={[
                  styles.small,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    left: cx - size / 2,
                    top: cy - size / 2,
                  },
                  isDone
                    ? { backgroundColor: tokens.accentFill }
                    : { backgroundColor: tokens.surface, borderWidth: 2, borderColor: tokens.border },
                ]}
              >
                {isDone ? <Feather name="check" size={14} color={tokens.onAccent} /> : null}
              </View>
            )}
            <Text
              style={[
                styles.label,
                {
                  left: cx - 45,
                  top: labelTop,
                  color: isCurrent ? tokens.textPrimary : tokens.textSecondary,
                  fontWeight: isCurrent ? '700' : '500',
                },
              ]}
            >
              {labels[index]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    width: 90,
    textAlign: 'center',
    fontSize: 12,
  },
});
