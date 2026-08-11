import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { buildInviteLink, shareInvite } from '@/utils/invite';
import { colors, radius, spacing } from '@/utils/theme';

export default function ShareScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent } = useEvents();
  const { resetDraft } = useEventDraft();
  const event = getEvent(id);

  if (event === undefined) {
    return (
      <Screen>
        <Header title={t('rsvp.notFoundTitle')} showBack />
      </Screen>
    );
  }

  const link = buildInviteLink(event.id);

  const goToDashboard = () => {
    resetDraft();
    router.navigate('/');
  };

  return (
    <Screen
      footer={
        <>
          <Button label={t('event.shareInvitation')} onPress={() => void shareInvite(event)} />
          <Button label={t('common.done')} variant="ghost" onPress={goToDashboard} />
        </>
      }
    >
      <Header
        title={t('createWizard.shareTitle')}
        subtitle={t('createWizard.shareSubtitle')}
        step={4}
        totalSteps={4}
      />

      <Card>
        <Text style={styles.cardLabel}>{t('createWizard.inviteLinkLabel')}</Text>
        <View style={styles.linkBox}>
          <Text style={styles.link} numberOfLines={2}>
            {link}
          </Text>
        </View>
        <Text style={styles.hint}>{t('createWizard.linkHint')}</Text>
      </Card>

      <Button
        label={t('event.previewAsGuest')}
        variant="secondary"
        onPress={() => router.push({ pathname: '/invite/[id]', params: { id: event.id } })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  linkBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  link: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: colors.faint,
    lineHeight: 17,
  },
});
