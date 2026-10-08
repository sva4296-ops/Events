import Feather from '@expo/vector-icons/Feather';
import { Children, isValidElement, type ReactElement, type ReactNode, cloneElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { themeRadius, typography } from '@/utils/themeTokens';

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * Warm Story 2.0 grouped list: an uppercase caption over one bordered card
 * whose rows are separated by hairlines (Profile's "Cont", "Ajutor", …).
 */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const { tokens } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<ListRowProps>[];

  return (
    <View style={styles.group}>
      {title !== undefined ? (
        <Text style={[styles.caption, { color: tokens.textSecondary }]}>{title}</Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        {rows.map((row, index) => cloneElement(row, { showDivider: index > 0 }))}
      </View>
    </View>
  );
}

interface ListRowProps {
  icon: FeatherName;
  label: string;
  /** Second muted line under the label. */
  description?: string;
  /** Muted value on the right, e.g. "Română". */
  value?: string;
  /** Replaces `value` with any node, e.g. a plan badge. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Set by ListGroup; don't pass it yourself. */
  showDivider?: boolean;
}

export function ListRow({ icon, label, description, value, trailing, onPress, showDivider = false }: ListRowProps) {
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={onPress === undefined}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={[
        styles.row,
        description !== undefined && styles.rowTall,
        showDivider && { borderTopWidth: 1, borderTopColor: tokens.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tokens.surface2 }]}>
        <Feather name={icon} size={18} color={tokens.textSecondary} />
      </View>
      {description !== undefined ? (
        <View style={styles.texts}>
          <Text style={[styles.labelInText, { color: tokens.textPrimary }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.description, { color: tokens.textSecondary }]}>{description}</Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: tokens.textPrimary }]} numberOfLines={1}>
          {label}
        </Text>
      )}
      {trailing ??
        (value !== undefined ? (
          <Text style={[styles.value, { color: tokens.textSecondary }]}>{value}</Text>
        ) : null)}
      {/* A row with its own trailing control (badge, switch) doesn't navigate anywhere. */}
      {onPress !== undefined && trailing === undefined ? (
        <Feather name="chevron-right" size={18} color={tokens.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  caption: {
    ...typography.overline,
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  card: {
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  rowTall: {
    paddingVertical: 12,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  labelInText: {
    fontSize: 15,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    flexShrink: 1,
  },
});
