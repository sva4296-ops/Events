import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import type { EventTypeId } from '@/types/event';

/**
 * 0 Lansarea (always done once the event exists), 1 Parcursul (before the
 * day), 2 Ziua X (the day itself), 3 Recap (after). An unparseable date
 * (null days) stays on Parcursul.
 */
export function currentStage(days: number | null): number {
  if (days === null || days > 0) return 1;
  if (days === 0) return 2;
  return 3;
}

/** Label of the event-day stage: the type's own word ("Nunta", "Botezul"),
 * or the generic "Ziua cea mare" when there's no event (onboarding). */
export function stageDayKey(type?: EventTypeId): string {
  return type !== undefined ? `eventTypes.${type}.stageDay` : 'onboarding.stageDayX';
}

/** Height of the wave's box; its middle runs through the nodes' centers. */
const WAVE_HEIGHT = 30;
const WAVE_MIDDLE = 15;
/** How far each curve bends away from the middle, alternating up and down. */
const WAVE_BEND = 22;

/** Curve from stage `index`'s node to the next one; nodes sit at the middle of four equal columns. */
function waveSegment(index: number, width: number): string {
  const column = width / 4;
  const start = column * (index + 0.5);
  const end = start + column;
  const control = index % 2 === 0 ? WAVE_MIDDLE - WAVE_BEND : WAVE_MIDDLE + WAVE_BEND;
  return `M ${start} ${WAVE_MIDDLE} Q ${(start + end) / 2} ${control} ${end} ${WAVE_MIDDLE}`;
}

/** Four-stage story timeline: done stages checked, the current one haloed, in the current accent. */
export function StoryTimeline({ stage, type }: { stage: number; type?: EventTypeId }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const stages = [
    t('onboarding.stageLaunch'),
    t('onboarding.stageJourney'),
    t(stageDayKey(type)),
    t('onboarding.stageRecap'),
  ];
  // The current accent (app theme, or the event's cover theme inside an event).
  const gradient = [tokens.accentFill, tokens.accentFill] as const;
  const doneFill = tokens.accentFill;
  const doneInk = tokens.onAccent;
  const haloTint = tokens.accentTint;
  const [width, setWidth] = useState(0);

  return (
    <View style={styles.timeline} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={WAVE_HEIGHT} style={styles.wave}>
          {[0, 1, 2].map((index) => (
            <Path
              key={index}
              d={waveSegment(index, width)}
              fill="none"
              strokeLinecap="round"
              strokeWidth={2}
              // The road travelled is solid, what's ahead dashed.
              stroke={index < stage ? doneFill : tokens.border}
              strokeDasharray={index < stage ? undefined : '4 5'}
            />
          ))}
        </Svg>
      ) : null}
      {stages.map((label, index) => {
        const done = index < stage;
        const current = index === stage;
        return (
          <View key={label} style={styles.stage}>
            {done ? (
              <View style={[styles.node, { backgroundColor: doneFill }]}>
                <Feather name="check" size={13} color={doneInk} />
              </View>
            ) : current ? (
              <View style={[styles.currentHalo, { backgroundColor: haloTint }]}>
                <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.node}>
                  <View style={styles.currentDot} />
                </LinearGradient>
              </View>
            ) : (
              <View
                style={[styles.node, { backgroundColor: tokens.surface, borderWidth: 2, borderColor: tokens.border }]}
              />
            )}
            <Text
              style={[
                styles.stageLabel,
                { color: current ? tokens.textPrimary : tokens.textSecondary, fontWeight: current ? '700' : '500' },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // Node centers are 11 from the top; the wave's middle lines up with them.
  wave: {
    position: 'absolute',
    left: 0,
    top: 11 - WAVE_MIDDLE,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    margin: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  stageLabel: {
    fontSize: 12,
  },
});
