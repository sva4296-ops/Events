import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gSpace } from '@/utils/guestTheme';

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
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
            borderWidth: 1,
          },
          tokens.surfaceElevatedShadow ?? undefined,
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: tokens.accentTint }]}>
          <Feather name="credit-card" size={28} color={tokens.accentText} />
        </View>
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
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 24,
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
