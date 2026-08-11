import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { EventDraft } from '@/types/event';
import { getEventType } from '@/utils/eventTypes';
import { formatEventDate } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

/** Accepts both a wizard draft and a saved event — the shapes overlap. */
export function InviteCard({ event }: { event: EventDraft }) {
  const { tokens } = useTheme();
  const type = getEventType(event.type);
  const name = event.name.trim();
  const location = event.location.trim();
  const message = event.welcomeMessage.trim();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: tokens.surfaceBorder ?? 'transparent',
          borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
        },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <LinearGradient colors={type.gradient} style={styles.cover}>
        <Text style={styles.emoji}>{type.emoji}</Text>
        <Text style={[styles.kicker, { color: type.accent }]}>{type.label.toUpperCase()}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={[styles.name, { color: tokens.textPrimary }]}>
          {name.length > 0 ? name : 'Your event name'}
        </Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>{formatEventDate(event.date)}</Text>
        {location.length > 0 ? (
          <Text style={[styles.meta, { color: tokens.textSecondary }]}>{location}</Text>
        ) : null}
        {message.length > 0 ? (
          <>
            <View style={[styles.divider, { backgroundColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.08)' }]} />
            <Text style={[styles.message, { color: tokens.textPrimary }]}>{message}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.lg,
    overflow: 'hidden',
  },
  cover: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 48,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  body: {
    padding: spacing.xl,
    gap: spacing.xs,
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  meta: {
    fontSize: 15,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: spacing.md,
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
