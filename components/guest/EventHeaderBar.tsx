import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { EventTypeId } from '@/types/event';
import { themeRadius, typography } from '@/utils/themeTokens';

type FeatherName = keyof typeof Feather.glyphMap;

export interface HeaderAction {
  key: string;
  icon: FeatherName;
  accessibilityLabel: string;
  onPress: () => void;
  /** Recolors the icon to the destructive tone — same circular button otherwise. */
  tone?: 'default' | 'destructive';
}

interface EventHeaderBarProps {
  name: string;
  /** Kept for callers; the type tile was dropped next to the back arrow (read as a second button). */
  type?: EventTypeId | null;
  /** Second line under the name, e.g. "12 iunie 2027 · Parcursul". */
  subtitle?: string;
  /** Only Acasă is the exit point back to the main events list — the other
   * five tabs are already reachable via the bottom tab bar within this same
   * event, so a back arrow there would (incorrectly) suggest leaving the
   * event entirely. Decided per-tab by the tabs layout, not by this component. */
  showBack?: boolean;
  /** Top-right, one row alongside the back button — which action(s) show here
   * (guests/stats on Acasă, edit on Detalii, edit+delete on Fond, none
   * elsewhere) is decided per-tab by the tabs layout, not by this component. */
  actions?: HeaderAction[];
}

/**
 * Persistent header for the event tabs (Warm Story 2.0): back, the
 * name in Playfair with date · stage under it, then per-tab actions. The back
 * arrow (when shown) always lands on Home rather than the previous tab.
 */
export function EventHeaderBar({ name, subtitle, showBack = false, actions = [] }: EventHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const buttonStyle = [styles.iconButton, { backgroundColor: tokens.surface, borderColor: tokens.border }];

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 12 }]}>
      {showBack ? (
        <TouchableOpacity
          style={buttonStyle}
          onPress={() => router.navigate('/')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Înapoi la ecranul principal"
        >
          <Feather name="chevron-left" size={20} color={tokens.textPrimary} />
        </TouchableOpacity>
      ) : null}

      {/* Stays as a spacer when empty, so actions keep to the right. */}
      <View style={styles.titleBlock}>
        {name.length > 0 ? (
          <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
        ) : null}
        {subtitle !== undefined ? (
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={buttonStyle}
          onPress={action.onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
        >
          <Feather
            name={action.icon}
            size={20}
            color={action.tone === 'destructive' ? tokens.destructive : tokens.textPrimary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.title2.fontFamily,
    fontSize: 20,
    lineHeight: 25,
  },
  subtitle: {
    fontSize: 13,
  },
});
