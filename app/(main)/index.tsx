import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { EventsListPane } from '@/components/EventsListPane';
import { useTheme } from '@/hooks/useTheme';
import { gSpace } from '@/utils/guestTheme';

/**
 * On native this route IS Home — full page, unchanged from before this pass.
 * On web, the list itself lives in the persistent left pane rendered by
 * app/(main)/_layout.tsx; this route is only ever the *right* pane's content
 * when nothing is selected yet, so it's just a lightweight placeholder —
 * rendering EventsListPane again here would duplicate the list next to
 * itself once an event is opened elsewhere in the same layout.
 */
export default function HomeRoute() {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View style={styles.placeholder}>
        <Feather name="calendar" size={32} color={tokens.textSecondary} />
        <Text style={[styles.placeholderText, { color: tokens.textSecondary }]}>
          {t('home.selectEventPlaceholder')}
        </Text>
      </View>
    );
  }

  return <EventsListPane />;
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: gSpace.md,
    paddingHorizontal: gSpace.xxl,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
