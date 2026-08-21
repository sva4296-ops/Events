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

export default function DetaliiAccommodationScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content, deleteAccommodation } = useEventContent(id ?? '');
  const { tokens } = useTheme();

  if (content === null) {
    return (
      <Screen>
        <Header title={t('detalii.hub.accommodationTitle')} showBack />
      </Screen>
    );
  }

  const card = cardStyle(tokens);

  return (
    <GuestScreen topInset>
      <Header
        title={t('detalii.hub.accommodationTitle')}
        subtitle={t('detalii.accommodationDescription')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surfaceElevated }]}
              onPress={() => router.push(`/accommodation/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă cazare"
            >
              <Feather name="plus" size={18} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {content.accommodations.length === 0 ? (
        <EmptyState
          message={owner ? t('detalii.accommodationEmptyOwner') : t('detalii.accommodationEmptyGuest')}
          action={
            owner ? (
              <GuestButton
                label={t('detalii.addAccommodation')}
                onPress={() => router.push(`/accommodation/${id}`)}
              />
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
