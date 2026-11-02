import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { CoverArt } from '@/components/CoverArt';
import { EventTypeIcon } from '@/components/EventTypeIcon';
import { fetchEventCoverUrl } from '@/data/eventsRepository';
import { useTheme } from '@/hooks/useTheme';
import type { EventTypeId } from '@/types/event';
import { getCoverTheme, type CoverDecoration, type CoverTheme } from '@/utils/coverThemes';
import type { ThemeTokens } from '@/utils/themeTokens';

/** Decoration for an event type's default cover. */
const TYPE_DECORATION: Record<EventTypeId, CoverDecoration> = {
  wedding: 'wedrings',
  baptism: 'drop',
  birthday: 'confetti',
  cause: 'hearts',
  corporate: 'grid',
  memorial: 'line',
  other: 'sparkles',
  spontaneous: 'disco',
  venue: 'table',
};

/**
 * Default cover when the organizer didn't pick a theme: drawn in the app
 * theme's own colors (Hârtie, Șampanie, …) with the type's decoration.
 */
export function defaultCover(type: EventTypeId, tokens: ThemeTokens): CoverTheme {
  const dark = tokens.mode === 'dark';
  return {
    id: `default-${type}`,
    colors: dark ? [tokens.surface2, tokens.surface, tokens.surface2] : [tokens.accentTint, tokens.surface2, tokens.accentTint],
    glows: [
      [tokens.accentPrimary, 0.82, 0.25],
      [dark ? tokens.accentText : tokens.surface, 0.15, 0.85],
    ],
    decoration: TYPE_DECORATION[type],
    ink: tokens.accentText,
    accent: tokens.accentFill,
    light: !dark,
  };
}

/** The organizer's own photo over the drawn cover, which stays as the fallback
 * while it loads or if it can't be signed. Cached on disk by path. */
function CoverPhoto({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ['eventCover', path],
    queryFn: () => fetchEventCoverUrl(path),
    // The URL lasts 24h.
    staleTime: 23 * 60 * 60_000,
  });
  if (url === undefined || url === null) return null;
  return (
    <Image
      source={{ uri: url, cacheKey: path }}
      cachePolicy="disk"
      contentFit="cover"
      transition={150}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** An event's cover: its picked theme, otherwise the app-themed default. */
export function EventCover({
  type,
  coverTheme,
  photoPath = null,
  thumbnail = false,
  style,
  children,
}: {
  type: EventTypeId;
  coverTheme?: string | null;
  /** events.cover_photo_path: wins over the theme. */
  photoPath?: string | null;
  /** Small list square: no illustration, just the colors with the type's icon centered. */
  thumbnail?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { tokens } = useTheme();
  const picked = getCoverTheme(coverTheme);
  if (thumbnail) {
    // One look for every list square: a soft tint of the event's accent (its
    // theme's, or the app's for Classic) with the type's icon in that accent.
    // Mixing full gradients with plain tiles read as inconsistent.
    const accent = picked?.accent ?? tokens.accentFill;
    return (
      <View
        style={[
          style,
          { backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, overflow: 'hidden' },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: accent, opacity: tokens.mode === 'dark' ? 0.28 : 0.16 }]} />
        <View style={styles.center}>
          <EventTypeIcon type={type} size={22} color={tokens.mode === 'dark' ? tokens.textPrimary : accent} />
        </View>
        {photoPath !== null ? <CoverPhoto path={photoPath} /> : null}
      </View>
    );
  }
  return (
    <CoverArt theme={picked ?? defaultCover(type, tokens)} style={style}>
      {photoPath !== null ? <CoverPhoto path={photoPath} /> : null}
      {children}
    </CoverArt>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
