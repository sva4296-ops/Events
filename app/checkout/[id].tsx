import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * Placeholder for the Stripe flow. Next iteration: Stripe Connect onboarding for
 * the organizer, a PaymentSheet here, and a contributions row written on success.
 */
export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();

  return (
    <GuestScreen contentStyle={styles.page} topInset>
      <View
        style={[
          styles.card,
          {
            backgroundColor: tokens.surfaceElevated,
            borderColor: tokens.surfaceBorder ?? 'transparent',
            borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
          },
          tokens.surfaceElevatedShadow ?? undefined,
        ]}
      >
        <Feather name="credit-card" size={30} color={tokens.accentPrimary} />
        <Text style={[styles.title, { color: tokens.textPrimary }]}>Plata vine în curând</Text>
        <Text style={[styles.body, { color: tokens.textSecondary }]}>
          Aici se va deschide Stripe Checkout. Momentan este doar un pas simulat — nu se face
          nicio plată reală.
        </Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>Eveniment: {id}</Text>
      </View>

      <GuestButton label="Înapoi la fond" variant="outline" onPress={() => router.back()} />
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    justifyContent: 'center',
    flexGrow: 1,
  },
  card: {
    borderRadius: themeRadius.lg,
    padding: gSpace.xxl,
    alignItems: 'center',
    gap: gSpace.md,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  meta: {
    fontSize: 11,
  },
});
