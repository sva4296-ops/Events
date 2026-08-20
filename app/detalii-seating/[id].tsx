import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SwipeableRow } from '@/components/SwipeableRow';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { gSpace } from '@/utils/guestTheme';
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
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content, deleteSeatingTable } = useEventContent(id ?? '');
  const { tokens } = useTheme();

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
});
