import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { buildInviteLink, shareInvite } from '@/utils/invite';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

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
        <Text style={[styles.cardLabel, { color: tokens.textSecondary }]}>
          {t('createWizard.inviteLinkLabel')}
        </Text>
        <View style={[styles.linkBox, { backgroundColor: `${tokens.accentPrimary}18` }]}>
          <Text style={[styles.link, { color: tokens.accentPrimary }]} numberOfLines={2}>
            {link}
          </Text>
        </View>
        <Text style={[styles.hint, { color: tokens.textSecondary }]}>{t('createWizard.linkHint')}</Text>
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
  },
  linkBox: {
    borderRadius: themeRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
});
