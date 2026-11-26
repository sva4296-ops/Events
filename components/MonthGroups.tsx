import Feather from '@expo/vector-icons/Feather';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import { haptics } from '@/utils/haptics';
import i18n from '@/utils/i18n';
import { spacing } from '@/utils/theme';
import { themeRadius, typeface } from '@/utils/themeTokens';

const NO_DATE = 'none';

/** 'YYYY-MM' of the event's day (a bare YYYY-MM-DD is a calendar day, not UTC midnight), or NO_DATE. */
function monthKey(value: string): string {
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (trimmed.length === 0 || Number.isNaN(parsed.getTime())) return NO_DATE;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const year = iso ? parsed.getUTCFullYear() : parsed.getFullYear();
  const month = iso ? parsed.getUTCMonth() : parsed.getMonth();
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** "Octombrie 2027"; the year is left out for the current one. */
function monthLabel(key: string, noDate: string): string {
  if (key === NO_DATE) return noDate;
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const sameYear = year === new Date().getFullYear();
  const label = new Date(year, month - 1, 1).toLocaleDateString(i18n.language, {
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Events grouped by month, each month a dropdown: tap the header to show its
 * events underneath, tap again to fold them away. Keeps the order it's given.
 */
export function MonthGroups({
  events,
  renderRow,
  openFirst = false,
}: {
  events: readonly AppEvent[];
  renderRow: (event: AppEvent, index: number) => ReactNode;
  /** Start with the first month unfolded (the nearest one, for what's coming). */
  openFirst?: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const groups: { key: string; events: AppEvent[] }[] = [];
  for (const event of events) {
    const key = monthKey(event.date);
    const group = groups.find((entry) => entry.key === key);
    if (group !== undefined) group.events.push(event);
    else groups.push({ key, events: [event] });
  }

  const [open, setOpen] = useState<Set<string>>(() =>
    openFirst && groups[0] !== undefined ? new Set([groups[0].key]) : new Set(),
  );

  const toggle = (key: string) => {
    haptics.tap();
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.stack}>
      {groups.map((group) => {
        const expanded = open.has(group.key);
        const label = monthLabel(group.key, t('home.dashboard.noDate'));
        return (
          <Animated.View
            key={group.key}
            layout={LinearTransition.duration(220)}
            style={[styles.group, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          >
            <TouchableOpacity
              onPress={() => toggle(group.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${label}, ${group.events.length}`}
              style={styles.header}
            >
              <Text style={[styles.label, { color: tokens.textPrimary }]} numberOfLines={1}>
                {label}
              </Text>
              <View style={[styles.count, { backgroundColor: expanded ? tokens.accentTint : tokens.surface2 }]}>
                <Text style={[styles.countText, { color: expanded ? tokens.accentText : tokens.textSecondary }]}>
                  {group.events.length}
                </Text>
              </View>
              <Feather
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={expanded ? tokens.accentText : tokens.textSecondary}
              />
            </TouchableOpacity>
            {expanded ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.rows, { borderTopColor: tokens.border }]}
              >
                {group.events.map((event, index) => renderRow(event, index))}
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  group: {
    borderRadius: themeRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  label: {
    flex: 1,
    fontFamily: typeface.bodySemiBold,
    fontSize: 16,
  },
  count: {
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
  },
  countText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
});
