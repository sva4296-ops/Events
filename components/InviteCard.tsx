import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import type { EventDraft } from '@/types/event';
import { getEventType } from '@/utils/eventTypes';
import { formatEventDate } from '@/utils/format';
import { colors, radius, shadow, spacing } from '@/utils/theme';

/** Accepts both a wizard draft and a saved event — the shapes overlap. */
export function InviteCard({ event }: { event: EventDraft }) {
  const type = getEventType(event.type);
  const name = event.name.trim();
  const location = event.location.trim();
  const message = event.welcomeMessage.trim();

  return (
    <View style={styles.card}>
      <LinearGradient colors={type.gradient} style={styles.cover}>
        <Text style={styles.emoji}>{type.emoji}</Text>
        <Text style={[styles.kicker, { color: type.accent }]}>{type.label.toUpperCase()}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.name}>{name.length > 0 ? name : 'Your event name'}</Text>
        <Text style={styles.meta}>{formatEventDate(event.date)}</Text>
        {location.length > 0 ? <Text style={styles.meta}>{location}</Text> : null}
        {message.length > 0 ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.message}>{message}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
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
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  meta: {
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
