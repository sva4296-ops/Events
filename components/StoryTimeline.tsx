import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { brandGradient } from '@/utils/themeTokens';

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

/** Warm Story 2.0 four-stage story timeline: done stages checked, the current one haloed. */
export function StoryTimeline({ stage }: { stage: number }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const stages = [
    t('onboarding.stageLaunch'),
    t('onboarding.stageJourney'),
    t('onboarding.stageDayX'),
    t('onboarding.stageRecap'),
  ];

  return (
    <View style={styles.timeline}>
      <View style={[styles.track, { backgroundColor: tokens.border }]} />
      {stage > 0 ? (
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.track, { right: undefined, width: `${(75 * stage) / 3}%` }]}
        />
      ) : null}
      {stages.map((label, index) => {
        const done = index < stage;
        const current = index === stage;
        return (
          <View key={label} style={styles.stage}>
            {done ? (
              <View style={[styles.node, { backgroundColor: tokens.accentFill }]}>
                <Feather name="check" size={13} color={tokens.onAccent} />
              </View>
            ) : current ? (
              <View style={[styles.currentHalo, { backgroundColor: tokens.accentTint }]}>
                <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.node}>
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
  track: {
    position: 'absolute',
    left: '12.5%',
    right: '12.5%',
    top: 10,
    height: 2,
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
