import Feather from '@expo/vector-icons/Feather';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { showDialog } from '@/components/ActionSheet';
import { Header } from '@/components/Header';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { ToggleSwitch } from '@/components/Toggle';
import type { NotificationCategory } from '@/data/notificationsRepository';
import { useNotificationPreferences, type NotificationSetting } from '@/hooks/useNotificationPreferences';
import { useTheme } from '@/hooks/useTheme';
import { disablePushNotifications, enablePushNotifications, isPushActive } from '@/utils/pushNotifications';
import { spacing } from '@/utils/theme';

type FeatherName = keyof typeof Feather.glyphMap;

const CATEGORIES: readonly NotificationCategory[] = ['organizer', 'reminders', 'updates', 'chat'];

const TYPE_ICON: Record<string, FeatherName> = {
  rsvp_response: 'user-check',
  event_reminder: 'clock',
  menu_reminder: 'coffee',
  event_changed: 'map-pin',
  new_moment: 'star',
  album_ready: 'image',
  event_cancelled: 'x-circle',
  chat_message: 'message-circle',
};

/**
 * Notification center: the device switch (moved here from Profile) plus one
 * account-level switch per push type. Types are enforced server-side
 * (send_notification), so they apply to every device the user is signed in on.
 */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { settings, hydrated, failed, retry, setEnabled } = useNotificationPreferences();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshPush = useCallback(() => {
    void isPushActive().then(setPushEnabled);
  }, []);

  // Also on return from the system Settings app, where permission may have changed.
  useEffect(() => {
    refreshPush();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPush();
    });
    return () => subscription.remove();
  }, [refreshPush]);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    if (pushEnabled) {
      setPushEnabled(false);
      await disablePushNotifications();
    } else {
      const result = await enablePushNotifications();
      setPushEnabled(result === 'enabled');
      if (result === 'blocked') {
        showDialog({
          title: t('profile.notificationsBlockedTitle'),
          message: t('profile.notificationsBlockedMessage'),
          buttons: [
            { label: t('common.cancel'), style: 'cancel' },
            { label: t('profile.openSettings'), onPress: () => void Linking.openSettings() },
          ],
        });
      }
    }
    setPushBusy(false);
  };

  const renderRow = (setting: NotificationSetting) => (
    <ListRow
      key={setting.key}
      icon={TYPE_ICON[setting.key] ?? 'bell'}
      label={t(`notifications.types.${setting.key}.title`)}
      description={t(`notifications.types.${setting.key}.description`)}
      trailing={
        setting.locked ? (
          <View accessibilityLabel={t('notifications.alwaysOn')}>
            <Feather name="lock" size={18} color={tokens.textMuted} />
          </View>
        ) : (
          <ToggleSwitch value={setting.enabled} />
        )
      }
      onPress={setting.locked ? undefined : () => setEnabled(setting, !setting.enabled)}
    />
  );

  return (
    <Screen contentStyle={styles.content}>
      <Header title={t('notifications.title')} subtitle={t('notifications.subtitle')} showBack />

      <ListGroup>
        <ListRow
          icon="smartphone"
          label={t('notifications.deviceToggle')}
          trailing={<ToggleSwitch value={pushEnabled} />}
          onPress={() => void togglePush()}
        />
      </ListGroup>
      {!pushEnabled ? (
        <Text style={[styles.note, { color: tokens.textSecondary }]}>{t('notifications.deviceOffNote')}</Text>
      ) : null}

      <View style={[styles.sections, !pushEnabled && styles.disabled]} pointerEvents={pushEnabled ? 'auto' : 'none'}>
      {failed ? (
        <View style={styles.failed}>
          <Text style={[styles.note, styles.failedText, { color: tokens.textSecondary }]}>
            {t('notifications.loadFailed')}
          </Text>
          <Button label={t('notifications.retry')} variant="secondary" onPress={retry} />
        </View>
      ) : !hydrated ? (
        <ActivityIndicator color={tokens.textSecondary} style={styles.loader} />
      ) : (
        CATEGORIES.map((category) => {
          const rows = settings.filter((setting) => setting.category === category);
          if (rows.length === 0) return null;
          return (
            <ListGroup key={category} title={t(`notifications.categories.${category}`)}>
              {rows.map(renderRow)}
            </ListGroup>
          );
        })
      )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -12,
    paddingHorizontal: 4,
  },
  failed: {
    gap: spacing.md,
  },
  failedText: {
    marginTop: 0,
    textAlign: 'center',
  },
  sections: {
    gap: 22,
  },
  disabled: {
    opacity: 0.4,
  },
  loader: {
    marginTop: spacing.lg,
  },
});
