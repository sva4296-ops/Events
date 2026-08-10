import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { SectionLabel } from '@/components/guest/SectionLabel';
import { SwipeableRow } from '@/components/SwipeableRow';
import { confirmDelete } from '@/utils/confirm';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { SELF_GUEST_ID } from '@/utils/guests';
import { fonts, guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Fără gluten', 'Fără lactoză'] as const;

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

export default function DetaliiScreen() {
  const { id, event } = useGuestEvent();
  const { isOwner, updateMyDietaryPreferences } = useEvents();
  const { mode } = useAuth();
  const {
    content,
    deleteScheduleItem,
    deleteSeatingTable,
    deleteAccommodation,
    deleteVendor,
  } = useEventContent(id);

  if (content === null) return <GuestScreen transparent />;

  const owner = isOwner(event);
  const hasVenue = content.venue.name.trim().length > 0 || content.venue.address.trim().length > 0;

  const myGuest =
    owner || event === undefined
      ? undefined
      : mode === 'supabase'
        ? event.guests[0]
        : event.guests.find((g) => g.id === SELF_GUEST_ID);
  const myDietary = myGuest?.dietaryPreferences ?? [];

  const toggleDietary = (option: string) => {
    if (myGuest === undefined) return;
    const next = myDietary.includes(option)
      ? myDietary.filter((entry) => entry !== option)
      : [...myDietary, option];
    updateMyDietaryPreferences(id, next);
  };

  return (
    <GuestScreen transparent>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>PROGRAMUL ZILEI</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={styles.edit}
              onPress={() => router.push(`/schedule/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă un moment în program"
            >
              <Feather name="plus" size={16} color={guest.purple} />
            </TouchableOpacity>
          ) : null}
        </View>
        {content.schedule.length === 0 ? (
          <EmptyState
            message={
              owner
                ? 'Nu ai adăugat încă programul zilei.'
                : 'Programul nu a fost publicat încă.'
            }
            action={
              owner ? (
                <GuestButton label="Adaugă programul" onPress={() => router.push(`/schedule/${id}`)} />
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
                    label: 'Editează',
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/schedule/${id}?itemId=${item.id}`),
                  },
                  {
                    label: 'Șterge',
                    icon: 'trash-2',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        'Ștergi acest moment din program?',
                        `„${item.title}” va dispărea din programul zilei.`,
                        () => deleteScheduleItem(item.id),
                      ),
                  },
                ]}
              >
                <View style={styles.scheduleCard}>
                  <Text style={styles.time}>{item.time}</Text>
                  <View style={styles.scheduleBody}>
                    <Text style={styles.scheduleTitle}>{item.title}</Text>
                    <Text style={styles.scheduleLocation}>{item.location}</Text>
                  </View>
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionLabel>LOCAȚIE & CUM AJUNGI</SectionLabel>
        {!hasVenue ? (
          <EmptyState
            message={owner ? 'Nu ai setat încă locația.' : 'Locația nu a fost publicată încă.'}
            action={
              owner ? (
                <GuestButton
                  label="Setează locația"
                  onPress={() => router.push(`/venue/${id}`)}
                />
              ) : undefined
            }
          />
        ) : (
          <View style={styles.mapCard}>
          {owner ? (
            <TouchableOpacity
              style={styles.venueEdit}
              onPress={() => router.push(`/venue/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează locația"
            >
              <Feather name="edit-2" size={16} color={guest.purple} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.mapPreview}>
            <Image source={{ uri: content.venue.map_image_url }} style={styles.map} />
            <View style={styles.pin}>
              <Text style={styles.pinText}>📍</Text>
            </View>
          </View>

          <View style={styles.venueBody}>
            <Text style={styles.venueName}>{content.venue.name}</Text>
            <Text style={styles.venueAddress}>{content.venue.address}</Text>
            <View style={styles.notes}>
              {content.venue.notes.map((note) => (
                <View key={note} style={styles.noteRow}>
                  <View style={styles.dot} />
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>MENIUL SERII</SectionLabel>
          {owner && content.menu !== null ? (
            <TouchableOpacity
              style={styles.edit}
              onPress={() => router.push(`/menu/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează meniul"
            >
              <Feather name="edit-2" size={16} color={guest.purple} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.sectionDescription}>
          Ce se servește și preferințele alimentare ale invitaților.
        </Text>

        {content.menu === null ? (
          <EmptyState
            message={owner ? 'Nu ai adăugat încă meniul.' : 'Meniul nu a fost publicat încă.'}
            action={
              owner ? <GuestButton label="Adaugă meniul" onPress={() => router.push(`/menu/${id}`)} /> : undefined
            }
          />
        ) : (
          <View style={styles.menuCard}>
            <View style={styles.courseRow}>
              <Text style={styles.courseLabel}>Antreu</Text>
              <Text style={styles.courseValue}>{content.menu.starter || '—'}</Text>
            </View>
            <View style={styles.courseRow}>
              <Text style={styles.courseLabel}>Fel principal</Text>
              <Text style={styles.courseValue}>{content.menu.main || '—'}</Text>
            </View>
            <View style={styles.courseRow}>
              <Text style={styles.courseLabel}>Desert</Text>
              <Text style={styles.courseValue}>{content.menu.dessert || '—'}</Text>
            </View>

            {!owner ? (
              <View style={styles.pillRow}>
                {DIETARY_OPTIONS.map((option) => {
                  const active = myDietary.includes(option);
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => toggleDietary(option)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>AȘEZAREA LA MESE</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={styles.edit}
              onPress={() => router.push(`/table/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă o masă"
            >
              <Feather name="plus" size={16} color={guest.purple} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.sectionDescription}>Cine stă la fiecare masă în seara evenimentului.</Text>

        {content.seatingTables.length === 0 ? (
          <EmptyState
            message={owner ? 'Nu ai organizat încă mesele.' : 'Așezarea la mese nu a fost publicată încă.'}
            action={
              owner ? <GuestButton label="Adaugă o masă" onPress={() => router.push(`/table/${id}`)} /> : undefined
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
                    label: 'Editează',
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/table/${id}?itemId=${table.id}`),
                  },
                  {
                    label: 'Șterge',
                    icon: 'trash-2',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        'Ștergi această masă?',
                        `„${table.name}” va dispărea din așezarea la mese.`,
                        () => deleteSeatingTable(table.id),
                      ),
                  },
                ]}
              >
                <View style={styles.rowCard}>
                  <Text style={styles.rowTitle}>{table.name}</Text>
                  {table.label.length > 0 ? <Text style={styles.rowSubtitle}>{table.label}</Text> : null}
                  <Text style={styles.rowMeta}>
                    {table.seat_count} {table.seat_count === 1 ? 'loc' : 'locuri'}
                  </Text>
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>CAZARE RECOMANDATĂ</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={styles.edit}
              onPress={() => router.push(`/accommodation/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă cazare"
            >
              <Feather name="plus" size={16} color={guest.purple} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.sectionDescription}>Unde pot sta invitații care vin de departe.</Text>

        {content.accommodations.length === 0 ? (
          <EmptyState
            message={owner ? 'Nu ai adăugat opțiuni de cazare.' : 'Opțiunile de cazare nu au fost publicate încă.'}
            action={
              owner ? (
                <GuestButton label="Adaugă cazare" onPress={() => router.push(`/accommodation/${id}`)} />
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
                    label: 'Editează',
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/accommodation/${id}?itemId=${entry.id}`),
                  },
                  {
                    label: 'Șterge',
                    icon: 'trash-2',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        'Ștergi această opțiune de cazare?',
                        `„${entry.name}” va dispărea din lista de cazare.`,
                        () => deleteAccommodation(entry.id),
                      ),
                  },
                ]}
              >
                <View style={styles.rowCard}>
                  <Text style={styles.rowTitle}>{entry.name}</Text>
                  {entry.detail_line.length > 0 ? (
                    <Text style={styles.rowSubtitle}>{entry.detail_line}</Text>
                  ) : null}
                  {entry.price_line.length > 0 ? (
                    <Text style={styles.rowMeta}>{entry.price_line}</Text>
                  ) : null}
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionLabel>CEI CARE FAC TOTUL POSIBIL</SectionLabel>
          {owner ? (
            <TouchableOpacity
              style={styles.edit}
              onPress={() => router.push(`/vendor/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă furnizor"
            >
              <Feather name="plus" size={16} color={guest.purple} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.sectionDescription}>
          Furnizorii care au ajutat să prindă viață seara aceasta.
        </Text>

        {content.vendors.length === 0 ? (
          <EmptyState
            message={owner ? 'Niciun furnizor adăugat.' : 'Niciun furnizor publicat încă.'}
            action={
              owner ? <GuestButton label="Adaugă furnizor" onPress={() => router.push(`/vendor/${id}`)} /> : undefined
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
                      label: 'Editează',
                      icon: 'edit-2',
                      tone: 'edit',
                      onPress: () => router.push(`/vendor/${id}?itemId=${vendor.id}`),
                    },
                    {
                      label: 'Șterge',
                      icon: 'trash-2',
                      tone: 'delete',
                      onPress: () =>
                        confirmDelete(
                          'Ștergi acest furnizor?',
                          `„${vendor.name}” va dispărea din listă.`,
                          () => deleteVendor(vendor.id),
                        ),
                    },
                  ]}
                >
                  <View style={styles.vendorCard}>
                    <View style={styles.vendorIconWrap}>
                      <Text style={styles.vendorIcon}>{vendorIcon(vendor.category)}</Text>
                    </View>
                    <View style={styles.vendorBody}>
                      <Text style={styles.rowTitle}>{vendor.name}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
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
                        <Text style={styles.vendorLink}>Vezi</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </SwipeableRow>
              ))}
            </View>
            <Text style={styles.vendorCaption}>
              Furnizorii tag-uiți își promovează serviciile — fiecare aduce clienți noi pe platformă.
            </Text>
          </>
        )}
      </View>
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
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
    color: guest.body,
  },
  edit: {
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    backgroundColor: guest.purpleSoft,
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
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    padding: gSpace.xl,
    ...gShadow,
  },
  time: {
    fontSize: 19,
    fontWeight: '800',
    color: guest.purple,
    width: 62,
  },
  scheduleBody: {
    flex: 1,
    gap: 2,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: guest.ink,
  },
  scheduleLocation: {
    fontSize: 13,
    color: guest.body,
  },
  mapCard: {
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    overflow: 'hidden',
    ...gShadow,
  },
  venueEdit: {
    position: 'absolute',
    top: gSpace.md,
    right: gSpace.md,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    backgroundColor: guest.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...gShadow,
  },
  mapPreview: {
    height: 170,
    backgroundColor: guest.creamDeep,
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
    backgroundColor: guest.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...gShadow,
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
    color: guest.ink,
  },
  venueAddress: {
    fontSize: 14,
    color: guest.body,
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
    backgroundColor: guest.gold,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: guest.body,
    lineHeight: 19,
  },
  menuCard: {
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    padding: gSpace.xl,
    gap: gSpace.md,
    ...gShadow,
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
    color: guest.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  courseValue: {
    flex: 1,
    fontSize: 14,
    color: guest.ink,
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
    backgroundColor: guest.creamDeep,
    borderWidth: 1,
    borderColor: guest.line,
  },
  pillActive: {
    backgroundColor: guest.purple,
    borderColor: guest.purple,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: guest.body,
  },
  pillTextActive: {
    color: guest.white,
  },
  rowCard: {
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    padding: gSpace.xl,
    gap: 2,
    ...gShadow,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: guest.ink,
  },
  rowSubtitle: {
    fontSize: 13,
    color: guest.body,
  },
  rowMeta: {
    fontSize: 12,
    color: guest.faint,
    marginTop: 2,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    padding: gSpace.lg,
    ...gShadow,
  },
  vendorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: gRadius.pill,
    backgroundColor: guest.creamDeep,
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
    color: guest.purple,
  },
  vendorCaption: {
    fontSize: 12,
    lineHeight: 17,
    color: guest.faint,
    fontStyle: 'italic',
    paddingHorizontal: gSpace.xs,
  },
});
