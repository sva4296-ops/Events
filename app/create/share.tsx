import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Button, buttonLabelColor } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';

/** Last step of the create wizard (5 of 5): the event exists; send it out. */
export default function ShareScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent } = useEvents();
  const { resetDraft } = useEventDraft();
  const { tokens } = useTheme();
  const event = getEvent(id);

  if (event === undefined) {
    return (
      <Screen>
        <Header title={t('rsvp.notFoundTitle')} showBack />
      </Screen>
    );
  }

  // The WhatsApp queue only lists pending guests with a phone who haven't
  // been messaged yet. A brand-new event has none, so send the organizer to
  // add guests first instead of into an empty queue.
  const hasGuestsToMessage = event.guests.some(
    (guest) => guest.status === 'pending' && guest.whatsappSentAt === null && guest.phone !== null,
  );

  const leave = (path: '/' | `/guest/${string}` | `/add-guest/${string}` | `/send-invites/${string}`) => {
    resetDraft();
    if (path === '/') {
      router.navigate('/');
    } else {
      router.replace(path);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('createWizard.shareWhatsApp')}
            variant="whatsapp"
            icon={<Feather name="message-circle" size={20} color={buttonLabelColor('whatsapp', tokens)} />}
            onPress={() =>
              leave(hasGuestsToMessage ? `/send-invites/${event.id}` : `/add-guest/${event.id}`)
            }
          />
          <Button
            label={t('createWizard.shareAddGuests')}
            variant="secondary"
            icon={<Feather name="users" size={20} color={buttonLabelColor('secondary', tokens)} />}
            onPress={() => leave(`/add-guest/${event.id}`)}
          />
          <Button
            label={t('createWizard.shareGoToEvent')}
            variant="ghost"
            onPress={() => leave(`/guest/${event.id}`)}
          />
        </>
      }
    >
      <View style={styles.top}>
        <TouchableOpacity
          style={[styles.close, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={() => leave('/')}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
          activeOpacity={0.7}
        >
          <Feather name="x" size={20} color={tokens.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <View
          style={[
            styles.markCircle,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
            tokens.surfaceElevatedShadow ?? undefined,
          ]}
        >
          <BrandMark width={72} strokeWidth={14} />
        </View>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('createWizard.shareTitle')}</Text>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
            {t('createWizard.shareSubtitle')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.lg,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 22,
    paddingTop: spacing.md,
  },
  markCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 10,
    alignItems: 'center',
  },
  title: {
    ...typography.title1,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
