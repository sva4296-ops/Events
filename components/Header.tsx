import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Renders an X in the opposite corner — used to exit a multi-step flow. */
  onClose?: () => void;
  /** 1-based wizard step, rendered as dots when `totalSteps` is set. */
  step?: number;
  totalSteps?: number;
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
  right,
}: HeaderProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      {showBack || onClose !== undefined || right !== undefined ? (
        <View style={styles.controls}>
          {showBack ? <BackButton /> : null}

          <View style={styles.rightGroup}>
            {right}

            {onClose !== undefined ? (
              <TouchableOpacity
                style={[
                  styles.control,
                  {
                    backgroundColor: tokens.surfaceElevated,
                    borderColor: tokens.surfaceBorder ?? 'transparent',
                    borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
                  },
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel and return home"
                activeOpacity={0.7}
              >
                <Feather name="x" size={18} color={tokens.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {step !== undefined && totalSteps !== undefined ? (
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: index < step ? tokens.accentPrimary : `${tokens.textSecondary}33` },
              ]}
            />
          ))}
        </View>
      ) : null}

      <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
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
    marginBottom: spacing.xs,
  },
  control: {
    width: 40,
    height: 40,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightGroup: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 22,
    height: 4,
    borderRadius: themeRadius.pill,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
});
