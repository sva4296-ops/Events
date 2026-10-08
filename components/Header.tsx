import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { SegmentedProgress } from '@/components/SegmentedProgress';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Renders an X in the opposite corner — used to exit a multi-step flow. */
  onClose?: () => void;
  /** 1-based wizard step, rendered as a progress bar when `totalSteps` is set. */
  step?: number;
  totalSteps?: number;
  /** Gradient for the filled progress bars (default: the brand's). */
  progressColors?: readonly [string, string, ...string[]];
  /** Warm Story 2.0 wizard chrome: centered flow name between the controls, e.g. "Eveniment nou". */
  flowTitle?: string;
  /** Line under `flowTitle`, e.g. "Pasul 1 din 5 · Tipul". */
  stepLabel?: string;
  /** A single action rendered top-right, opposite the back button — e.g. an edit icon. */
  right?: ReactNode;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onClose,
  step,
  totalSteps,
  progressColors,
  flowTitle,
  stepLabel,
  right,
}: HeaderProps) {
  const { tokens } = useTheme();
  const hasControls = showBack || onClose !== undefined || right !== undefined || flowTitle !== undefined;

  return (
    <View style={styles.container}>
      {hasControls ? (
        <View style={styles.controls}>
          {showBack ? <BackButton /> : <View style={styles.spacer} />}

          <View style={styles.center}>
            {flowTitle !== undefined ? (
              <Text style={[styles.flowTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                {flowTitle}
              </Text>
            ) : null}
            {stepLabel !== undefined ? (
              <Text style={[styles.stepLabel, { color: tokens.textSecondary }]} numberOfLines={1}>
                {stepLabel}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightGroup}>
            {right}

            {onClose !== undefined ? (
              <TouchableOpacity
                style={[styles.control, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel and return home"
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={tokens.textPrimary} />
              </TouchableOpacity>
            ) : right === undefined ? (
              <View style={styles.spacer} />
            ) : null}
          </View>
        </View>
      ) : null}

      {step !== undefined && totalSteps !== undefined ? (
        <View style={styles.progress}>
          <SegmentedProgress total={totalSteps} current={step - 1} colors={progressColors} />
        </View>
      ) : null}

      {title.length > 0 ? <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text> : null}
      {subtitle !== undefined ? (
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  flowTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  stepLabel: {
    fontSize: 13,
  },
  spacer: {
    width: 44,
  },
  control: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progress: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title1,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
});
