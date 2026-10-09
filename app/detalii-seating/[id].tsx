import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { FloorPlan } from '@/components/FloorPlan';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { Screen } from '@/components/Screen';
import { LongPressRow } from '@/components/LongPressRow';
import { fetchTableCompanions } from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { haptics } from '@/utils/haptics';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surface,
    borderColor: tokens.border,
    borderWidth: 1,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

export default function DetaliiSeatingScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getEvent, isVenueManager, isRestaurant } = useEvents();
  const event = getEvent(id);
  const owner = isVenueManager(event);
  const { content, deleteSeatingTable, moveSeatingTable } = useEventContent(id ?? '');
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

  // A seated guest opens straight on the plan, centered on their table.
  const [view, setView] = useState<'list' | 'plan'>(() => (myTableId !== null ? 'plan' : 'list'));
  const [selectedTableId, setSelectedTableId] = useState<string | null>(myTableId);

  if (content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header title={t('detalii.hub.seatingTitle')} showBack />
      </Screen>
    );
  }

  const card = cardStyle(tokens);
  const hasTables = content.seatingTables.length > 0;
  const showPlan = hasTables && view === 'plan';

  const assignedByTable = new Map<string, number>();
  if (owner) {
    event?.guests.forEach((guest) => {
      if (guest.tableId !== null) assignedByTable.set(guest.tableId, (assignedByTable.get(guest.tableId) ?? 0) + 1);
    });
  }
  const selectedTable = content.seatingTables.find((table) => table.id === selectedTableId) ?? null;
  const selectedIsMine = selectedTable !== null && selectedTable.id === myTableId;

  const segment = hasTables ? (
    <View style={[styles.segment, { backgroundColor: tokens.surface2 }]} accessibilityRole="tablist">
      {(['list', 'plan'] as const).map((option) => {
        const active = option === view;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.segmentItem, active ? [styles.segmentActive, { backgroundColor: tokens.surface }] : null]}
            onPress={() => {
              haptics.tap();
              setView(option);
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Feather name={option === 'list' ? 'list' : 'grid'} size={16} color={active ? tokens.textPrimary : tokens.textSecondary} />
            <Text style={[styles.segmentText, { color: active ? tokens.textPrimary : tokens.textSecondary }]}>
              {option === 'list' ? t('detalii.seatingViewList') : t('detalii.seatingViewPlan')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  ) : null;

  return (
    <GuestScreen coverType={event?.type} topInset scroll={!showPlan} contentStyle={showPlan ? styles.planPage : undefined}>
      <Header
        title={t('detalii.hub.seatingTitle')}
        subtitle={t('detalii.seatingDescription')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border, borderWidth: 1 }]}
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

      {segment}

      {showPlan ? (
        <>
          <FloorPlan
            tables={content.seatingTables}
            owner={owner}
            myTableId={myTableId}
            selectedTableId={owner ? null : selectedTableId}
            assignedByTable={assignedByTable}
            onTapTable={(tableId) => {
              if (owner) {
                router.push(`/table/${id}?itemId=${tableId}`);
              } else {
                haptics.tap();
                setSelectedTableId(tableId);
              }
            }}
            onMoveTable={moveSeatingTable}
            youAreHereLabel={t('detalii.seatingYoureHere')}
            fitLabel={t('detalii.seatingPlanFit')}
            locateLabel={t('detalii.seatingPlanLocate')}
          />
          {!owner && selectedTable !== null ? (
            <View
              style={[
                styles.rowCard,
                card,
                selectedIsMine ? { borderColor: tokens.accentPrimary, borderWidth: 2, backgroundColor: tokens.accentTint } : null,
              ]}
            >
              <View style={styles.titleRow}>
                <Text style={[styles.rowTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                  {selectedTable.name}
                </Text>
                {selectedIsMine ? (
                  <View style={[styles.hereBadge, { backgroundColor: tokens.accentFill }]}>
                    <Feather name="check" size={11} color={tokens.onAccent} />
                    <Text style={[styles.hereBadgeText, { color: tokens.onAccent }]}>{t('detalii.seatingYoureHere')}</Text>
                  </View>
                ) : null}
              </View>
              {selectedTable.label.length > 0 ? (
                <Text style={[styles.rowSubtitle, { color: tokens.textSecondary }]}>{selectedTable.label}</Text>
              ) : null}
              <Text style={[styles.rowMeta, { color: tokens.textSecondary }]}>
                {t('detalii.seatCount', { count: selectedTable.seat_count })}
              </Text>
              {selectedIsMine && companions.length > 0 ? (
                <Text style={[styles.rowMeta, { color: tokens.textPrimary }]}>
                  {t('detalii.seatingWithYou', { names: companions.join(', ') })}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.planHint, { color: tokens.textSecondary }]}>
              {owner ? t('detalii.seatingPlanHintOwner') : t('detalii.seatingPlanHintGuest')}
            </Text>
          )}
        </>
      ) : content.seatingTables.length === 0 ? (
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
              <LongPressRow
                title={table.name}
                key={table.id}
                enabled={owner}
                actions={[
                  {
                    label: t('common.edit'),
                    icon: 'edit-2',
                    tone: 'edit',
                    onPress: () => router.push(`/table/${id}?itemId=${table.id}`),
                  },
                  // The restaurant can't delete a table people are seated at
                  // (also enforced server-side).
                  ...(isRestaurant(event) && assignedCount > 0 ? [] : [{
                    label: t('common.delete'),
                    icon: 'trash-2' as const,
                    tone: 'delete' as const,
                    onPress: () =>
                      confirmDelete(
                        t('detalii.deleteTableTitle'),
                        t('detalii.deleteTableBody', { name: table.name }),
                        () => deleteSeatingTable(table.id),
                      ),
                  }]),
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
                          backgroundColor: tokens.accentTint,
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
                      <View style={[styles.hereBadge, { backgroundColor: tokens.accentFill }]}>
                        <Feather name="check" size={11} color={tokens.onAccent} />
                        <Text style={[styles.hereBadgeText, { color: tokens.onAccent }]}>{t('detalii.seatingYoureHere')}</Text>
                      </View>
                    ) : null}
                    {owner ? (
                      <IconCircleButton
                        size="sm"
                        icon="edit-2"
                        accessibilityLabel={t('common.edit')}
                        onPress={() => router.push(`/table/${id}?itemId=${table.id}`)}
                      />
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
                    <Text style={[styles.rowMeta, { color: tokens.accentText }]}>
                      {t('tableForm.seatsAssignedCount', { assigned: assignedCount, total: table.seat_count })}
                    </Text>
                  ) : null}
                  {isMine && companions.length > 0 ? (
                    <Text style={[styles.rowMeta, { color: tokens.textPrimary }]}>
                      {t('detalii.seatingWithYou', { names: companions.join(', ') })}
                    </Text>
                  ) : null}
                </View>
              </LongPressRow>
            );
          })}
        </View>
      )}
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
  stack: {
    gap: gSpace.md,
  },
  rowCard: {
    borderRadius: themeRadius.xl,
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
    flexShrink: 1,
  },
  hereBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  planPage: {
    paddingHorizontal: 20,
    gap: gSpace.lg,
  },
  planHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  segmentActive: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
});
