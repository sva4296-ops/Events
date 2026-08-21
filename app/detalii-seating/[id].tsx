import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SwipeableRow } from '@/components/SwipeableRow';
import { fetchTableCompanions } from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surfaceElevated,
    borderColor: tokens.surfaceBorder ?? 'transparent',
    borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

export default function DetaliiSeatingScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content, deleteSeatingTable } = useEventContent(id ?? '');
  const { tokens } = useTheme();

  // RLS already limits a non-organizer's event.guests to just their own row,
  // so [0] is "my" row — same pattern the menu tab's dietary pills already use.
  const myGuest = owner || event === undefined ? undefined : event.guests[0];
  const myTableId = myGuest?.tableId ?? null;

  // Co-assigned names aren't in event.guests for a guest viewer at all (RLS
  // only exposes their own row) — this has to go through a dedicated RPC.
  // See data/eventsRepository.ts's fetchTableCompanions.
  const companionsQuery = useQuery({
    queryKey: ['tableCompanions', id, user?.id ?? null],
    queryFn: () => fetchTableCompanions(id as string),
    enabled: !owner && myTableId !== null && id !== undefined,
    staleTime: 30_000,
  });
  const companions = companionsQuery.data ?? [];

  if (content === null) {
    return (
      <Screen>
        <Header title={t('detalii.hub.seatingTitle')} showBack />
      </Screen>
    );
  }

  const card = cardStyle(tokens);

  return (
    <GuestScreen topInset>
      <Header
        title={t('detalii.hub.seatingTitle')}
        subtitle={t('detalii.seatingDescription')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surfaceElevated }]}
              onPress={() => router.push(`/table/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă o masă"
            >
              <Feather name="plus" size={18} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {content.seatingTables.length === 0 ? (
        <EmptyState
          message={owner ? t('detalii.seatingEmptyOwner') : t('detalii.seatingEmptyGuest')}
          action={
            owner ? <GuestButton label={t('detalii.addTable')} onPress={() => router.push(`/table/${id}`)} /> : undefined
          }
        />
      ) : (
        <View style={styles.stack}>
          {content.seatingTables.map((table) => {
            const assignedCount = event?.guests.filter((guest) => guest.tableId === table.id).length ?? 0;
            const isMine = !owner && myTableId !== null && table.id === myTableId;
            return (
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
                <View
                  style={[
                    styles.rowCard,
                    card,
                    isMine
                      ? {
                          borderColor: tokens.accentPrimary,
                          borderWidth: 2,
                          backgroundColor: `${tokens.accentPrimary}14`,
                        }
                      : null,
                  ]}
                >
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.rowTitle, { color: tokens.textPrimary }]}
                      numberOfLines={1}
                    >
                      {table.name}
                    </Text>
                    {isMine ? (
                      <View style={[styles.hereBadge, { backgroundColor: tokens.accentPrimary }]}>
                        <Feather name="check" size={11} color="#FFFFFF" />
                        <Text style={styles.hereBadgeText}>{t('detalii.seatingYoureHere')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {table.label.length > 0 ? (
                    <Text style={[styles.rowSubtitle, { color: tokens.textSecondary }]}>{table.label}</Text>
                  ) : null}
                  <Text style={[styles.rowMeta, { color: tokens.textSecondary }]}>
                    {t('detalii.seatCount', { count: table.seat_count })}
                  </Text>
                  {/* Assigned-count is owner-only — a guest's own event.guests is
                      RLS-scoped to their own row, so this line would otherwise show
                      a misleading 0/1 on every table that isn't theirs. Their own
                      table shows real co-assigned names below instead. */}
                  {owner && assignedCount > 0 ? (
                    <Text style={[styles.rowMeta, { color: tokens.accentPrimary }]}>
                      {t('tableForm.seatsAssignedCount', { assigned: assignedCount, total: table.seat_count })}
                    </Text>
                  ) : null}
                  {isMine && companions.length > 0 ? (
                    <Text style={[styles.rowMeta, { color: tokens.textPrimary }]}>
                      {t('detalii.seatingWithYou', { names: companions.join(', ') })}
                    </Text>
                  ) : null}
                </View>
              </SwipeableRow>
            );
          })}
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
  stack: {
    gap: gSpace.md,
  },
  rowCard: {
    borderRadius: themeRadius.lg,
    padding: gSpace.xl,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: gSpace.sm,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  hereBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: gSpace.sm,
    paddingVertical: 4,
    borderRadius: gRadius.pill,
  },
  hereBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});
