import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { Screen } from '@/components/Screen';
import { LongPressRow } from '@/components/LongPressRow';
import { PhotoViewer } from '@/components/PhotoViewer';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import type { MenuOption } from '@/types/guest';
import { confirmDelete } from '@/utils/confirm';
import { formatShortDate } from '@/utils/format';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { haptics } from '@/utils/haptics';
import { isMenuChoiceClosed, lastMenuChoiceDay, MENU_DEADLINE_CHOICES } from '@/utils/menuDeadline';
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
    backgroundColor: tokens.surface,
    borderColor: tokens.border,
    borderWidth: 1,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

export default function DetaliiMenuScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isVenueManager, updateMyDietaryPreferences, updateMyMenuChoice } = useEvents();
  const event = getEvent(id);
  const owner = isVenueManager(event);
  const { content, deleteMenuOption, saveMenuDeadline } = useEventContent(id ?? '');
  const { tokens } = useTheme();
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  // A course photo opened full screen (tap on its thumbnail).
  const [viewer, setViewer] = useState<{ uri: string; caption: string } | null>(null);

  if (content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header title={t('detalii.hub.menuTitle')} showBack />
      </Screen>
    );
  }

  // RLS already limits a non-organizer's event.guests to just their own row,
  // so [0] is "my" row.
  const myGuest = owner || event === undefined ? undefined : event.guests[0];
  const myDietary = myGuest?.dietaryPreferences ?? [];
  const myChoice = myGuest?.menuOptionId ?? null;
  const canChoose = myGuest?.status === 'confirmed';

  const deadlineDays = content.menu?.choice_deadline_days ?? 2;
  const lastDay = lastMenuChoiceDay(event?.date ?? '', deadlineDays);
  const closed = isMenuChoiceClosed(event?.date ?? '', deadlineDays);
  const lastDayLabel = lastDay === null ? '' : formatShortDate(lastDay);

  const toggleDietary = (option: string) => {
    if (myGuest === undefined || id === undefined) return;
    const next = myDietary.includes(option)
      ? myDietary.filter((entry) => entry !== option)
      : [...myDietary, option];
    updateMyDietaryPreferences(id, next);
  };

  const choose = (option: MenuOption) => {
    if (id === undefined || !canChoose || closed || option.id === myChoice) return;
    haptics.tap();
    updateMyMenuChoice(id, option.id);
  };

  const card = cardStyle(tokens);
  const options = content.menuOptions;

  // Owner: who picked what, among confirmed guests.
  const confirmed = owner ? (event?.guests ?? []).filter((guest) => guest.status === 'confirmed') : [];
  const optionIds = new Set(options.map((option) => option.id));
  const notChosen = confirmed.filter((guest) => guest.menuOptionId === null || !optionIds.has(guest.menuOptionId));

  const guestNotice = !canChoose
    ? t('detalii.menuChooseNotConfirmed')
    : lastDay === null
      ? t('detalii.menuChooseNoDate')
      : closed
        ? t('detalii.menuChooseClosed', { date: lastDayLabel })
        : t('detalii.menuChooseOpen', { date: lastDayLabel });

  return (
    <GuestScreen coverType={event?.type} topInset>
      <Header
        title={t('detalii.hub.menuTitle')}
        subtitle={t('detalii.menuDescription')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border, borderWidth: 1 }]}
              onPress={() => router.push(`/menu/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('menuForm.addTitle')}
            >
              <Feather name="plus" size={18} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {options.length === 0 ? (
        <EmptyState
          message={owner ? t('detalii.menuEmptyOwner') : t('detalii.menuEmptyGuest')}
          action={
            owner ? <GuestButton label={t('detalii.addMenu')} onPress={() => router.push(`/menu/${id}`)} /> : undefined
          }
        />
      ) : (
        <>
          {owner ? (
            <View style={[styles.menuCard, card]}>
              <Text style={[styles.summaryTitle, { color: tokens.textPrimary }]}>
                {t('detalii.menuChosenSummary', { chosen: confirmed.length - notChosen.length, total: confirmed.length })}
              </Text>
              {notChosen.length > 0 ? (
                <Text style={[styles.meta, { color: tokens.textSecondary }]} numberOfLines={3}>
                  {t('detalii.menuNotChosen', { names: notChosen.map((guest) => guest.name).join(', ') })}
                </Text>
              ) : null}

              <Text style={[styles.courseLabel, styles.deadlineLabel, { color: tokens.textSecondary }]}>
                {t('detalii.menuDeadlineLabel')}
              </Text>
              <TouchableOpacity
                style={[
                  styles.select,
                  { backgroundColor: tokens.surface, borderColor: deadlineOpen ? tokens.accentPrimary : tokens.border },
                ]}
                onPress={() => {
                  haptics.tap();
                  setDeadlineOpen((open) => !open);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ expanded: deadlineOpen }}
                accessibilityLabel={`${t('detalii.menuDeadlineLabel')}: ${t('detalii.menuDeadlineDays', { count: deadlineDays })}`}
              >
                <Text style={[styles.selectText, { color: tokens.textPrimary }]}>
                  {t('detalii.menuDeadlineDays', { count: deadlineDays })}
                </Text>
                <Feather name={deadlineOpen ? 'chevron-up' : 'chevron-down'} size={18} color={tokens.textSecondary} />
              </TouchableOpacity>
              {deadlineOpen ? (
                <View style={[styles.dropdown, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                  {MENU_DEADLINE_CHOICES.map((days, index) => {
                    const active = days === deadlineDays;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[
                          styles.dropdownItem,
                          index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border } : null,
                          active ? { backgroundColor: tokens.accentTint } : null,
                        ]}
                        onPress={() => {
                          setDeadlineOpen(false);
                          if (active) return;
                          haptics.tap();
                          saveMenuDeadline(days);
                        }}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[
                            styles.dropdownText,
                            { color: active ? tokens.accentText : tokens.textPrimary, fontWeight: active ? '700' : '500' },
                          ]}
                        >
                          {t('detalii.menuDeadlineDays', { count: days })}
                        </Text>
                        {active ? <Feather name="check" size={16} color={tokens.accentText} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              <Text style={[styles.meta, { color: tokens.textSecondary }]}>
                {lastDay === null
                  ? t('detalii.menuDeadlineNoDate')
                  : closed
                    ? t('detalii.menuChooseClosed', { date: lastDayLabel })
                    : t('detalii.menuDeadlineOwnerLine', { date: lastDayLabel })}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.notice,
                { backgroundColor: closed ? tokens.surface2 : tokens.accentTint, borderColor: tokens.border },
              ]}
            >
              <Feather
                name={closed ? 'lock' : 'clock'}
                size={16}
                color={closed ? tokens.textSecondary : tokens.accentText}
              />
              <Text style={[styles.noticeText, { color: closed ? tokens.textSecondary : tokens.accentText }]}>
                {guestNotice}
              </Text>
            </View>
          )}

          <View style={styles.stack}>
            {options.map((option) => {
              const selected = !owner && option.id === myChoice;
              const pickers = owner ? confirmed.filter((guest) => guest.menuOptionId === option.id) : [];
              const dimmed = !owner && (closed || !canChoose) && !selected;
              const courses = (
                <>
                  <View style={styles.titleRow}>
                    <Text style={[styles.optionName, { color: tokens.textPrimary }]} numberOfLines={1}>
                      {option.name}
                    </Text>
                    {!owner && canChoose ? (
                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor: selected ? tokens.accentFill : tokens.border,
                            backgroundColor: selected ? tokens.accentFill : 'transparent',
                          },
                        ]}
                      >
                        {selected ? <Feather name="check" size={13} color={tokens.onAccent} /> : null}
                      </View>
                    ) : null}
                    {owner ? (
                      <IconCircleButton
                        size="sm"
                        icon="edit-2"
                        accessibilityLabel={t('common.edit')}
                        onPress={() => router.push(`/menu/${id}?itemId=${option.id}`)}
                      />
                    ) : null}
                  </View>
                  {option.courses.map((course, courseIndex) => (
                    // Courses have no id; their order is their identity.
                    <View key={courseIndex} style={styles.courseRow}>
                      {course.photo_url !== null ? (
                        <TouchableOpacity
                          onPress={() =>
                            setViewer({
                              uri: course.photo_url ?? '',
                              caption: [course.name, course.dish].filter((part) => part.trim().length > 0).join(' · '),
                            })
                          }
                          activeOpacity={0.8}
                          accessibilityRole="imagebutton"
                          accessibilityLabel={course.dish || course.name}
                        >
                          <Image
                            source={{ uri: course.photo_url }}
                            style={[styles.courseThumb, { backgroundColor: tokens.surface2 }]}
                            accessibilityIgnoresInvertColors
                          />
                        </TouchableOpacity>
                      ) : null}
                      <Text style={[styles.courseLabel, { color: tokens.textSecondary }]}>{course.name}</Text>
                      <Text style={[styles.courseValue, { color: tokens.textPrimary }]}>{course.dish}</Text>
                    </View>
                  ))}
                  {owner ? (
                    <Text style={[styles.meta, { color: tokens.accentText }]} numberOfLines={3}>
                      {t('detalii.menuOptionCount', { count: pickers.length })}
                      {pickers.length > 0 ? `: ${pickers.map((guest) => guest.name).join(', ')}` : ''}
                    </Text>
                  ) : null}
                </>
              );

              const cardStyles = [
                styles.menuCard,
                card,
                selected ? { borderColor: tokens.accentPrimary, borderWidth: 2, backgroundColor: tokens.accentTint } : null,
                dimmed ? styles.dimmed : null,
              ];

              if (owner) {
                return (
                  <LongPressRow
                title={option.name}
                    key={option.id}
                    actions={[
                      {
                        label: t('common.edit'),
                        icon: 'edit-2',
                        tone: 'edit',
                        onPress: () => router.push(`/menu/${id}?itemId=${option.id}`),
                      },
                      {
                        label: t('common.delete'),
                        icon: 'trash-2',
                        tone: 'delete',
                        onPress: () =>
                          confirmDelete(
                            t('detalii.deleteMenuOptionTitle'),
                            t('detalii.deleteMenuOptionBody', { name: option.name }),
                            () => deleteMenuOption(option.id),
                          ),
                      },
                    ]}
                  >
                    <View style={cardStyles}>{courses}</View>
                  </LongPressRow>
                );
              }

              return (
                <TouchableOpacity
                  key={option.id}
                  style={cardStyles}
                  onPress={() => choose(option)}
                  disabled={!canChoose || closed}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: !canChoose || closed }}
                  accessibilityLabel={option.name}
                >
                  {courses}
                </TouchableOpacity>
              );
            })}
          </View>

          {!owner ? (
            <View style={[styles.menuCard, card]}>
              <Text style={[styles.courseLabel, { color: tokens.textSecondary }]}>{t('detalii.dietaryTitle')}</Text>
              <View style={styles.pillRow}>
                {DIETARY_OPTIONS.map((option) => {
                  const active = myDietary.includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: active ? tokens.accentTint : tokens.surface,
                          borderColor: active ? tokens.accentPrimary : tokens.border,
                        },
                      ]}
                      onPress={() => toggleDietary(option)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.pillText, { color: active ? tokens.accentText : tokens.textPrimary }]}>
                        {t(DIETARY_LABEL_KEY[option])}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </>
      )}
      <PhotoViewer
        uri={viewer?.uri}
        visible={viewer !== null}
        onClose={() => setViewer(null)}
        caption={viewer?.caption}
      />
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    borderRadius: themeRadius.xl,
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
    flexShrink: 1,
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
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: gRadius.pill,
    borderWidth: 1.5,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stack: {
    gap: gSpace.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: gSpace.sm,
  },
  optionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  deadlineLabel: {
    marginTop: gSpace.xs,
  },
  meta: {
    fontSize: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.sm,
    borderRadius: themeRadius.lg,
    borderWidth: 1,
    paddingHorizontal: gSpace.lg,
    paddingVertical: gSpace.md,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  dimmed: {
    opacity: 0.5,
  },
  courseThumb: {
    width: 48,
    height: 48,
    borderRadius: themeRadius.sm,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: gSpace.lg,
    borderRadius: themeRadius.md,
    borderWidth: 1.5,
  },
  selectText: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  dropdown: {
    borderRadius: themeRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: gSpace.lg,
  },
  dropdownText: {
    fontSize: 15,
    flexShrink: 1,
  },
});
