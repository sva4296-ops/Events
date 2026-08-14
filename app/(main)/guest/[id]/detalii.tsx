import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { SectionLabel } from '@/components/guest/SectionLabel';
import { Skeleton } from '@/components/Skeleton';
import { SwipeableRow } from '@/components/SwipeableRow';
import { confirmDelete } from '@/utils/confirm';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';
import { WEB_CONTENT_WIDTH } from '@/utils/webLayout';

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

/** Matches the vendor's own (user-typed) category text, so this stays
 * Romanian-keyword-based regardless of UI language — see the file-level note
 * on never translating user-generated content. */
function vendorIcon(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('foto') || normalized.includes('video')) return '📷';
  if (normalized.includes('muz') || normalized.includes('dj')) return '🎵';
  if (normalized.includes('catering') || normalized.includes('mânc') || normalized.includes('manc')) {
    return '🍽️';
  }
  if (normalized.includes('flor')) return '💐';
  if (normalized.includes('tort') || normalized.includes('cofet')) return '🎂';
  if (normalized.includes('transport') || normalized.includes('mașin') || normalized.includes('masin')) {
    return '🚗';
  }
  if (normalized.includes('decor')) return '🎈';
  return '🏷️';
}

/** A card's surface treatment — same shape for every section's card style. */
function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surfaceElevated,
    borderColor: tokens.surfaceBorder ?? 'transparent',
    borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

/**
 * All six sections load together (one combined content fetch — see
 * useEventContent), so there's no per-section loading state to track; this
 * mirrors the real layout of every section at once, reusing the same
 * container styles the real sections render into so nothing shifts on load.
 */
function DetaliiSkeleton() {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <GuestScreen transparent>
      <View style={styles.section}>
        <SectionLabel>{t('detalii.schedule')}</SectionLabel>
        <View style={styles.stack}>
          <View style={[styles.scheduleCard, cardStyle(tokens)]}>
            <Skeleton width={62} height={19} radius={4} />
            <View style={styles.scheduleBody}>
              <Skeleton height={16} width="60%" radius={4} />
              <Skeleton height={13} width="40%" radius={4} />
            </View>
          </View>
          <View style={[styles.scheduleCard, cardStyle(tokens)]}>
            <Skeleton width={62} height={19} radius={4} />
            <View style={styles.scheduleBody}>
              <Skeleton height={16} width="45%" radius={4} />
              <Skeleton height={13} width="55%" radius={4} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('detalii.venue')}</SectionLabel>
        <View style={[styles.mapCard, cardStyle(tokens)]}>
          <Skeleton height={170} radius={0} />
          <View style={styles.venueBody}>
            <Skeleton height={20} width="50%" radius={4} />
            <Skeleton height={14} width="70%" radius={4} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('detalii.menu')}</SectionLabel>
        <View style={[styles.menuCard, cardStyle(tokens)]}>
          <View style={styles.courseRow}>
            <Skeleton height={13} width={80} radius={4} />
            <Skeleton height={14} width="40%" radius={4} />
          </View>
          <View style={styles.courseRow}>
            <Skeleton height={13} width={80} radius={4} />
            <Skeleton height={14} width="40%" radius={4} />
          </View>
          <View style={styles.courseRow}>
            <Skeleton height={13} width={80} radius={4} />
            <Skeleton height={14} width="40%" radius={4} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('detalii.seating')}</SectionLabel>
        <View style={styles.stack}>
          <View style={[styles.rowCard, cardStyle(tokens)]}>
            <Skeleton height={16} width="45%" radius={4} />
            <Skeleton height={13} width="30%" radius={4} />
          </View>
          <View style={[styles.rowCard, cardStyle(tokens)]}>
            <Skeleton height={16} width="55%" radius={4} />
            <Skeleton height={13} width="35%" radius={4} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('detalii.accommodation')}</SectionLabel>
        <View style={styles.stack}>
          <View style={[styles.rowCard, cardStyle(tokens)]}>
            <Skeleton height={16} width="50%" radius={4} />
            <Skeleton height={13} width="65%" radius={4} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel>{t('detalii.vendors')}</SectionLabel>
        <View style={styles.stack}>
          <View style={[styles.vendorCard, cardStyle(tokens)]}>
            <Skeleton width={40} height={40} radius={gRadius.pill} />
            <View style={styles.vendorBody}>
              <Skeleton height={16} width="55%" radius={4} />
              <Skeleton height={13} width="70%" radius={4} />
            </View>
          </View>
        </View>
      </View>
    </GuestScreen>
  );
}

export default function DetaliiScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner, updateMyDietaryPreferences } = useEvents();
  const { tokens } = useTheme();
  const {
    content,
    deleteScheduleItem,
    deleteSeatingTable,
    deleteAccommodation,
    deleteVendor,
  } = useEventContent(id);

  if (content === null) return <DetaliiSkeleton />;

  const owner = isOwner(event);
  const hasVenue = content.venue.name.trim().length > 0 || content.venue.address.trim().length > 0;

  // RLS already limits a non-organizer's event.guests to just their own row,
  // so [0] is "my" row.
  const myGuest = owner || event === undefined ? undefined : event.guests[0];
  const myDietary = myGuest?.dietaryPreferences ?? [];

  const toggleDietary = (option: string) => {
    if (myGuest === undefined) return;
    const next = myDietary.includes(option)
      ? myDietary.filter((entry) => entry !== option)
      : [...myDietary, option];
    updateMyDietaryPreferences(id, next);
  };

  const card = cardStyle(tokens);
  const editButtonStyle = [styles.edit, { backgroundColor: `${tokens.accentPrimary}22` }];

  const scheduleSection = (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>{t('detalii.schedule')}</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={editButtonStyle}
              onPress={() => router.push(`/schedule/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă un moment în program"
            >
              <Feather name="plus" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {content.schedule.length === 0 ? (
          <EmptyState
            message={owner ? t('detalii.scheduleEmptyOwner') : t('detalii.scheduleEmptyGuest')}
            action={
              owner ? (
                <GuestButton label={t('detalii.addSchedule')} onPress={() => router.push(`/schedule/${id}`)} />
              ) : undefined
            }
          />
        ) : (
          <View style={styles.stack}>
            {content.schedule.map((item) => (
              <SwipeableRow
                key={item.id}
                enabled={owner}
                actions={[
                  {
                    label: t('common.edit'),
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/schedule/${id}?itemId=${item.id}`),
                  },
                  {
                    label: t('common.delete'),
                    icon: 'trash-2',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        t('detalii.deleteScheduleTitle'),
                        t('detalii.deleteScheduleBody', { title: item.title }),
                        () => deleteScheduleItem(item.id),
                      ),
                  },
                ]}
              >
                <View style={[styles.scheduleCard, card]}>
                  <Text style={[styles.time, { color: tokens.accentPrimary }]}>{item.time}</Text>
                  <View style={styles.scheduleBody}>
                    <Text style={[styles.scheduleTitle, { color: tokens.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.scheduleLocation, { color: tokens.textSecondary }]}>
                      {item.location}
                    </Text>
                  </View>
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </View>
  );

  const venueSection = (
      <View style={styles.section}>
        <SectionLabel>{t('detalii.venue')}</SectionLabel>
        {!hasVenue ? (
          <EmptyState
            message={owner ? t('detalii.venueEmptyOwner') : t('detalii.venueEmptyGuest')}
            action={
              owner ? (
                <GuestButton
                  label={t('detalii.setVenue')}
                  onPress={() => router.push(`/venue/${id}`)}
                />
              ) : undefined
            }
          />
        ) : (
          <View style={[styles.mapCard, card]}>
          {owner ? (
            <TouchableOpacity
              style={[styles.venueEdit, { backgroundColor: tokens.surfaceElevated }]}
              onPress={() => router.push(`/venue/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează locația"
            >
              <Feather name="edit-2" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
          ) : null}
          <View style={[styles.mapPreview, { backgroundColor: tokens.surface }]}>
            <Image source={{ uri: content.venue.map_image_url }} style={styles.map} />
            <View style={[styles.pin, { backgroundColor: tokens.surfaceElevated }]}>
              <Text style={styles.pinText}>📍</Text>
            </View>
          </View>

          <View style={styles.venueBody}>
            <Text style={[styles.venueName, { color: tokens.textPrimary }]}>{content.venue.name}</Text>
            <Text style={[styles.venueAddress, { color: tokens.textSecondary }]}>
              {content.venue.address}
            </Text>
            <View style={styles.notes}>
              {content.venue.notes.map((note) => (
                <View key={note} style={styles.noteRow}>
                  <View style={[styles.dot, { backgroundColor: tokens.accentGold }]} />
                  <Text style={[styles.noteText, { color: tokens.textSecondary }]}>{note}</Text>
                </View>
              ))}
            </View>
            </View>
          </View>
        )}
      </View>
  );

  const menuSection = (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>{t('detalii.menu')}</SectionLabel>
          {owner && content.menu !== null ? (
            <TouchableOpacity
              style={editButtonStyle}
              onPress={() => router.push(`/menu/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează meniul"
            >
              <Feather name="edit-2" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[styles.sectionDescription, { color: tokens.textSecondary }]}>
          {t('detalii.menuDescription')}
        </Text>

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
      </View>
  );

  const seatingSection = (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>{t('detalii.seating')}</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={editButtonStyle}
              onPress={() => router.push(`/table/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă o masă"
            >
              <Feather name="plus" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[styles.sectionDescription, { color: tokens.textSecondary }]}>
          {t('detalii.seatingDescription')}
        </Text>

        {content.seatingTables.length === 0 ? (
          <EmptyState
            message={owner ? t('detalii.seatingEmptyOwner') : t('detalii.seatingEmptyGuest')}
            action={
              owner ? <GuestButton label={t('detalii.addTable')} onPress={() => router.push(`/table/${id}`)} /> : undefined
            }
          />
        ) : (
          <View style={styles.stack}>
            {content.seatingTables.map((table) => (
              <SwipeableRow
                key={table.id}
                enabled={owner}
                actions={[
                  {
                    label: t('common.edit'),
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/table/${id}?itemId=${table.id}`),
                  },
                  {
                    label: t('common.delete'),
                    icon: 'trash-2',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        t('detalii.deleteTableTitle'),
                        t('detalii.deleteTableBody', { name: table.name }),
                        () => deleteSeatingTable(table.id),
                      ),
                  },
                ]}
              >
                <View style={[styles.rowCard, card]}>
                  <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{table.name}</Text>
                  {table.label.length > 0 ? (
                    <Text style={[styles.rowSubtitle, { color: tokens.textSecondary }]}>{table.label}</Text>
                  ) : null}
                  <Text style={[styles.rowMeta, { color: tokens.textSecondary }]}>
                    {t('detalii.seatCount', { count: table.seat_count })}
                  </Text>
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </View>
  );

  const accommodationSection = (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>{t('detalii.accommodation')}</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={editButtonStyle}
              onPress={() => router.push(`/accommodation/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă cazare"
            >
              <Feather name="plus" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[styles.sectionDescription, { color: tokens.textSecondary }]}>
          {t('detalii.accommodationDescription')}
        </Text>

        {content.accommodations.length === 0 ? (
          <EmptyState
            message={owner ? t('detalii.accommodationEmptyOwner') : t('detalii.accommodationEmptyGuest')}
            action={
              owner ? (
                <GuestButton label={t('detalii.addAccommodation')} onPress={() => router.push(`/accommodation/${id}`)} />
              ) : undefined
            }
          />
        ) : (
          <View style={styles.stack}>
            {content.accommodations.map((entry) => (
              <SwipeableRow
                key={entry.id}
                enabled={owner}
                actions={[
                  {
                    label: t('common.edit'),
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/accommodation/${id}?itemId=${entry.id}`),
                  },
                  {
                    label: t('common.delete'),
                    icon: 'trash-2',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        t('detalii.deleteAccommodationTitle'),
                        t('detalii.deleteAccommodationBody', { name: entry.name }),
                        () => deleteAccommodation(entry.id),
                      ),
                  },
                ]}
              >
                <View style={[styles.rowCard, card]}>
                  <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{entry.name}</Text>
                  {entry.detail_line.length > 0 ? (
                    <Text style={[styles.rowSubtitle, { color: tokens.textSecondary }]}>
                      {entry.detail_line}
                    </Text>
                  ) : null}
                  {entry.price_line.length > 0 ? (
                    <Text style={[styles.rowMeta, { color: tokens.textSecondary }]}>{entry.price_line}</Text>
                  ) : null}
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </View>
  );

  const vendorsSection = (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>{t('detalii.vendors')}</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={editButtonStyle}
              onPress={() => router.push(`/vendor/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă furnizor"
            >
              <Feather name="plus" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[styles.sectionDescription, { color: tokens.textSecondary }]}>
          {t('detalii.vendorsDescription')}
        </Text>

        {content.vendors.length === 0 ? (
          <EmptyState
            message={owner ? t('detalii.vendorsEmptyOwner') : t('detalii.vendorsEmptyGuest')}
            action={
              owner ? <GuestButton label={t('detalii.addVendor')} onPress={() => router.push(`/vendor/${id}`)} /> : undefined
            }
          />
        ) : (
          <>
            <View style={styles.stack}>
              {content.vendors.map((vendor) => (
                <SwipeableRow
                  key={vendor.id}
                  enabled={owner}
                  actions={[
                    {
                      label: t('common.edit'),
                      icon: 'edit-2',
                      tone: 'edit',
                      onPress: () => router.push(`/vendor/${id}?itemId=${vendor.id}`),
                    },
                    {
                      label: t('common.delete'),
                      icon: 'trash-2',
                      tone: 'delete',
                      onPress: () =>
                        confirmDelete(
                          t('detalii.deleteVendorTitle'),
                          t('detalii.deleteVendorBody', { name: vendor.name }),
                          () => deleteVendor(vendor.id),
                        ),
                    },
                  ]}
                >
                  <View style={[styles.vendorCard, card]}>
                    <View style={[styles.vendorIconWrap, { backgroundColor: tokens.surface }]}>
                      <Text style={styles.vendorIcon}>{vendorIcon(vendor.category)}</Text>
                    </View>
                    <View style={styles.vendorBody}>
                      <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{vendor.name}</Text>
                      <Text style={[styles.rowSubtitle, { color: tokens.textSecondary }]} numberOfLines={1}>
                        {[vendor.category, vendor.handle].filter((part) => part.length > 0).join(' · ')}
                      </Text>
                    </View>
                    {vendor.external_url.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => void Linking.openURL(vendor.external_url)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Vezi ${vendor.name}`}
                      >
                        <Text style={[styles.vendorLink, { color: tokens.accentPrimary }]}>
                          {t('detalii.vendorLink')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </SwipeableRow>
              ))}
            </View>
            <Text style={[styles.vendorCaption, { color: tokens.textSecondary }]}>
              {t('detalii.vendorCaption')}
            </Text>
          </>
        )}
      </View>
  );

  return (
    <GuestScreen transparent webMaxWidth={WEB_CONTENT_WIDTH.wide}>
      {Platform.OS === 'web' ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {scheduleSection}
            {venueSection}
          </View>
          <View style={styles.column}>
            {menuSection}
            {seatingSection}
            {accommodationSection}
            {vendorsSection}
          </View>
        </View>
      ) : (
        <>
          {scheduleSection}
          {venueSection}
          {menuSection}
          {seatingSection}
          {accommodationSection}
          {vendorsSection}
        </>
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  // Web only: schedule+venue on the left, the four logistics sections on
  // the right — an explicit split rather than a wrapping grid, so uneven
  // section heights don't create ragged rows.
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: gSpace.xl,
  },
  column: {
    flex: 1,
    gap: gSpace.lg,
  },
  section: {
    gap: gSpace.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionDescription: {
    fontSize: 13,
  },
  edit: {
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: gSpace.md,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.lg,
    borderRadius: themeRadius.lg,
    padding: gSpace.xl,
  },
  time: {
    fontSize: 19,
    fontWeight: '800',
    width: 62,
  },
  scheduleBody: {
    flex: 1,
    gap: 2,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  scheduleLocation: {
    fontSize: 13,
  },
  mapCard: {
    borderRadius: themeRadius.lg,
    overflow: 'hidden',
  },
  venueEdit: {
    position: 'absolute',
    top: gSpace.md,
    right: gSpace.md,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreview: {
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: {
    fontSize: 20,
  },
  venueBody: {
    padding: gSpace.xl,
    gap: gSpace.xs,
  },
  venueName: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  venueAddress: {
    fontSize: 14,
  },
  notes: {
    marginTop: gSpace.md,
    gap: gSpace.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: gRadius.pill,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
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
  rowCard: {
    borderRadius: themeRadius.lg,
    padding: gSpace.xl,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
    borderRadius: themeRadius.lg,
    padding: gSpace.lg,
  },
  vendorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorIcon: {
    fontSize: 18,
  },
  vendorBody: {
    flex: 1,
    gap: 2,
  },
  vendorLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  vendorCaption: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    paddingHorizontal: gSpace.xs,
  },
});
