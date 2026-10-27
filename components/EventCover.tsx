import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { View } from 'react-native';

import { CoverArt } from '@/components/CoverArt';
import { EventTypeIcon } from '@/components/EventTypeIcon';
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

/** An event's cover: its picked theme, otherwise the app-themed default. */
export function EventCover({
  type,
  coverTheme,
  thumbnail = false,
  style,
  children,
}: {
  type: EventTypeId;
  coverTheme?: string | null;
  /** Small list square: no illustration, just the colors with the type's icon centered. */
  thumbnail?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { tokens } = useTheme();
  const picked = getCoverTheme(coverTheme);
  if (thumbnail) {
    if (picked === null) {
      return (
        <View style={[style, { backgroundColor: tokens.accentTint, alignItems: 'center', justifyContent: 'center' }]}>
          <EventTypeIcon type={type} size={22} color={tokens.accentText} />
        </View>
      );
    }
    return (
      <CoverArt theme={picked} plain style={style}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EventTypeIcon type={type} size={22} color={picked.light ? '#2B2740' : '#FFFFFF'} />
        </View>
      </CoverArt>
    );
  }
  return (
    <CoverArt theme={picked ?? defaultCover(type, tokens)} style={style}>
      {children}
    </CoverArt>
  );
}
