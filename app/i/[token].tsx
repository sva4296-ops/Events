import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { fetchInviteEventIdByToken } from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { setPendingRoute } from '@/utils/pendingRoute';
import { reportSupabaseError } from '@/utils/reportError';

/**
 * Target of the personal WhatsApp invite link (https://<web>/i/<token>) when
 * the app is installed — app.json's intentFilters / associatedDomains route
 * that URL here instead of the browser. Resolves the token to its event and
 * hands off to the existing invite screen; without a session it goes through
 * sign-in first and AuthGate brings the user back (utils/pendingRoute.ts).
 */
export default function InviteTokenScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, loading } = useAuth();
  const { tokens } = useTheme();

  const query = useQuery({
    queryKey: ['inviteToken', token],
    queryFn: async () => {
      try {
        return await fetchInviteEventIdByToken(token as string);
      } catch (err) {
        reportSupabaseError(err);
        throw err;
      }
    },
    enabled: token !== undefined,
    staleTime: Infinity,
    retry: 1,
  });
  const eventId = query.data ?? null;

  useEffect(() => {
    if (loading || eventId === null) return;
    const target = `/invite/${eventId}` as const;
    if (user === null) {
      setPendingRoute(target);
      router.replace('/auth');
    } else {
      router.replace(target);
    }
  }, [loading, eventId, user]);

  const notFound = query.isError || (query.isSuccess && eventId === null);

  return (
    <Screen>
      <Header title={notFound ? t('rsvp.notFoundTitle') : t('rsvp.openingTitle')} />
      {notFound ? (
        <Text style={[styles.note, { color: tokens.textSecondary }]}>{t('rsvp.notFoundNote')}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: 14,
  },
});
