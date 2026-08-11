import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { colors, radius, spacing } from '@/utils/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Renders an X in the opposite corner — used to exit a multi-step flow. */
  onClose?: () => void;
  /** 1-based wizard step, rendered as dots when `totalSteps` is set. */
  step?: number;
  totalSteps?: number;
}

export function Header({
  title,
  subtitle,
  showBack = false,
  onClose,
  step,
  totalSteps,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      {showBack || onClose !== undefined ? (
        <View style={styles.controls}>
          {showBack ? <BackButton /> : null}

          {onClose !== undefined ? (
            <TouchableOpacity
              style={[styles.control, styles.close]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel and return home"
              activeOpacity={0.7}
            >
              <Feather name="x" size={18} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {step !== undefined && totalSteps !== undefined ? (
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <View key={index} style={[styles.dot, index < step && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <Text style={styles.title}>{title}</Text>
      {subtitle !== undefined ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    marginLeft: 'auto',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 22,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.muted,
  },
});
