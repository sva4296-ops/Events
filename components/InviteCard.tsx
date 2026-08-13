import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { EventDraft } from '@/types/event';
import { getEventType, getEventTypeGradient } from '@/utils/eventTypes';
import { formatEventDate } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

/** Accepts both a wizard draft and a saved event — the shapes overlap. */
export function InviteCard({ event }: { event: EventDraft }) {
  const { tokens, mode } = useTheme();
  const type = getEventType(event.type);
  const coverGradient = getEventTypeGradient(event.type, mode);
  // type.accent is tuned for contrast against the light-mode pastel
  // gradients only — against the dark-mode gradients it reads too close in
  // luminance to be legible (worst on corporate/memorial, whose accents are
  // themselves muted blue-grays). Dark mode uses textPrimary instead, same
  // as every other themed piece of text on this card.
  const kickerColor = mode === 'dark' ? tokens.textPrimary : type.accent;
  const name = event.name.trim();
  const location = event.location.trim();
  const message = event.welcomeMessage.trim();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surfaceElevated,
          // Light mode: unchanged — tokens.surfaceBorder is already null
          // there, so this has always evaluated to no border. Dark mode:
          // the app-wide 1px surfaceBorder (light-shadow/dark-border card
          // treatment used everywhere else) traces this card's *whole*
          // rounded rectangle, so it runs directly along the saturated
          // `cover` gradient at the top — instead of reading as a subtle
          // edge (as it does on a plain-fill card, where border and fill
          // are close in tone), it shows up as a visible, doubled outline
          // against the gradient. This card already gets a strong edge from
          // the gradient meeting the page background, so dropping the
          // border in dark mode is a deliberate, scoped exception for this
          // one component — not a change to the shared surfaceBorder token
          // or the dark-card pattern everywhere else.
          borderColor: mode === 'dark' ? 'transparent' : tokens.surfaceBorder ?? 'transparent',
          borderWidth: mode === 'dark' ? 0 : tokens.surfaceBorder !== null ? 1 : 0,
        },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <LinearGradient colors={coverGradient} style={styles.cover}>
        <Text style={styles.emoji}>{type.emoji}</Text>
        <Text style={[styles.kicker, { color: kickerColor }]}>{type.label.toUpperCase()}</Text>
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
    // A fixed height let a two-line kicker (the longer labels, e.g.
    // "CORPORATE") overflow past the box's own bottom edge and into the
    // body section below — since `body` starts wherever `cover`'s box ends,
    // not wherever its content actually stops. minHeight + vertical padding
    // lets the box grow with the content instead, so every label length
    // stacks cleanly regardless of how many lines it wraps to.
    minHeight: 150,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // `card`'s own overflow:'hidden' + borderRadius is supposed to clip this
    // gradient's corners to match, but in dark mode `card` also carries a
    // 1px borderColor (surfaceBorder) — combining overflow-clipping with a
    // sibling border is a known RN rendering gap where the child's square
    // corner can peek out past the rounded border, reading as a doubled
    // outline. Rounding the cover's own top corners to the same radius
    // means it's already shaped correctly before clipping is even needed,
    // so there's no seam for the border to show through.
    borderTopLeftRadius: themeRadius.lg,
    borderTopRightRadius: themeRadius.lg,
  },
  emoji: {
    fontSize: 48,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textAlign: 'center',
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
