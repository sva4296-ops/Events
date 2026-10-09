import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { Screen } from '@/components/Screen';
import { LongPressRow } from '@/components/LongPressRow';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surface,
    borderColor: tokens.border,
    borderWidth: 1,
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
  const { hydrated: planHydrated, capabilities } = usePlanGate(id ?? '');
  const { tokens } = useTheme();

  if (content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header title={t('detalii.hub.accommodationTitle')} showBack />
      </Screen>
    );
  }

  // Reached both via the hub card (already routed to /pricing instead when
  // locked) and directly, e.g. a stale deep link — checked again here so
  // this screen never shows the real list/composer regardless of how it was
  // reached. Server-side: a trigger on accommodations inserts (see the
  // plan-feature-gating migration).
  if (planHydrated && !capabilities.lodgingTransportEnabled) {
    return (
      <GuestScreen coverType={event?.type} topInset>
        <Header title={t('detalii.hub.accommodationTitle')} showBack />
        <EmptyState
          icon="lock"
          message={t('planGate.accommodationLocked')}
          action={
            owner ? (
              <GuestButton
                label={t('common.viewPlans')}
                onPress={() => router.push(`/pricing/${id}`)}
              />
            ) : undefined
          }
        />
      </GuestScreen>
    );
  }

  const card = cardStyle(tokens);

  return (
    <GuestScreen coverType={event?.type} topInset>
      <Header
        title={t('detalii.hub.accommodationTitle')}
        subtitle={t('detalii.accommodationDescription')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border, borderWidth: 1 }]}
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
            <LongPressRow
                title={entry.name}
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
              <View style={[styles.rowCard, styles.rowInline, card]}>
                <View style={styles.rowBody}>
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
                {owner ? (
                  <IconCircleButton
                    size="sm"
                    icon="edit-2"
                    accessibilityLabel={t('common.edit')}
                    onPress={() => router.push(`/accommodation/${id}?itemId=${entry.id}`)}
                  />
                ) : null}
              </View>
            </LongPressRow>
          ))}
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
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
  },
  rowBody: {
    flex: 1,
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
