import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

/**
 * These are the *stored* values in `event_guests.dietary_preferences` (and
 * what `toggleDietary` compares against) — not display text. They must stay
 * stable across languages: an existing row's stored 'Fără gluten' has to
 * keep matching this list regardless of the active UI language, or switching
 * languages would silently un-select every guest's saved preference. Only
 * the rendered label is translated — see DIETARY_LABEL_KEY below.
 */
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Fără gluten', 'Fără lactoză'] as const;

const DIETARY_LABEL_KEY: Record<(typeof DIETARY_OPTIONS)[number], string> = {
  Vegetarian: 'detalii.dietaryVegetarian',
  Vegan: 'detalii.dietaryVegan',
  'Fără gluten': 'detalii.dietaryGlutenFree',
  'Fără lactoză': 'detalii.dietaryDairyFree',
};

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surfaceElevated,
    borderColor: tokens.surfaceBorder ?? 'transparent',
    borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

export default function DetaliiMenuScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, updateMyDietaryPreferences } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content } = useEventContent(id ?? '');
  const { tokens } = useTheme();

  if (content === null) {
    return (
      <Screen>
        <Header title={t('detalii.hub.menuTitle')} showBack />
      </Screen>
    );
  }

  // RLS already limits a non-organizer's event.guests to just their own row,
  // so [0] is "my" row.
  const myGuest = owner || event === undefined ? undefined : event.guests[0];
  const myDietary = myGuest?.dietaryPreferences ?? [];

  const toggleDietary = (option: string) => {
    if (myGuest === undefined || id === undefined) return;
    const next = myDietary.includes(option)
      ? myDietary.filter((entry) => entry !== option)
      : [...myDietary, option];
    updateMyDietaryPreferences(id, next);
  };

  const card = cardStyle(tokens);

  return (
    <GuestScreen topInset>
      <Header
        title={t('detalii.hub.menuTitle')}
        subtitle={t('detalii.menuDescription')}
        showBack
        right={
          owner && content.menu !== null ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surfaceElevated }]}
              onPress={() => router.push(`/menu/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează meniul"
            >
              <Feather name="edit-2" size={18} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {content.menu === null ? (
        <EmptyState
          message={owner ? t('detalii.menuEmptyOwner') : t('detalii.menuEmptyGuest')}
          action={
            owner ? <GuestButton label={t('detalii.addMenu')} onPress={() => router.push(`/menu/${id}`)} /> : undefined
          }
        />
      ) : (
        <View style={[styles.menuCard, card]}>
          <View style={styles.courseRow}>
            <Text style={[styles.courseLabel, { color: tokens.textSecondary }]}>
              {t('detalii.courseStarter')}
            </Text>
            <Text style={[styles.courseValue, { color: tokens.textPrimary }]}>
              {content.menu.starter || '—'}
            </Text>
          </View>
          <View style={styles.courseRow}>
            <Text style={[styles.courseLabel, { color: tokens.textSecondary }]}>
              {t('detalii.courseMain')}
            </Text>
            <Text style={[styles.courseValue, { color: tokens.textPrimary }]}>
              {content.menu.main || '—'}
            </Text>
          </View>
          <View style={styles.courseRow}>
            <Text style={[styles.courseLabel, { color: tokens.textSecondary }]}>
              {t('detalii.courseDessert')}
            </Text>
            <Text style={[styles.courseValue, { color: tokens.textPrimary }]}>
              {content.menu.dessert || '—'}
            </Text>
          </View>

          {!owner ? (
            <View style={styles.pillRow}>
              {DIETARY_OPTIONS.map((option) => {
                const active = myDietary.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: active ? tokens.accentPrimary : tokens.surface,
                        borderColor: active ? tokens.accentPrimary : tokens.surfaceBorder ?? 'rgba(0,0,0,0.1)',
                      },
                    ]}
                    onPress={() => toggleDietary(option)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.pillText, { color: active ? '#FFFFFF' : tokens.textSecondary }]}>
                      {t(DIETARY_LABEL_KEY[option])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    borderRadius: themeRadius.lg,
    padding: gSpace.xl,
    gap: gSpace.md,
  },
  courseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: gSpace.md,
  },
  courseLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  courseValue: {
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gSpace.sm,
    marginTop: gSpace.xs,
  },
  pill: {
    paddingHorizontal: gSpace.lg,
    paddingVertical: gSpace.sm,
    borderRadius: gRadius.pill,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
