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

export default function DetaliiScheduleScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content, deleteScheduleItem } = useEventContent(id ?? '');
  const { tokens } = useTheme();

  if (content === null) {
    return (
      <Screen>
        <Header title={t('detalii.hub.scheduleTitle')} showBack />
      </Screen>
    );
  }

  const card = cardStyle(tokens);

  return (
    <GuestScreen topInset>
      <Header
        title={t('detalii.hub.scheduleTitle')}
        showBack
        right={
          owner ? (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: tokens.surfaceElevated }]}
              onPress={() => router.push(`/schedule/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Adaugă un moment în program"
            >
              <Feather name="plus" size={18} color={tokens.textPrimary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

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
});
