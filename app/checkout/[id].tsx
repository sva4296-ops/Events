import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { fonts, guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';

/**
 * Placeholder for the Stripe flow. Next iteration: Stripe Connect onboarding for
 * the organizer, a PaymentSheet here, and a contributions row written on success.
 */
export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <GuestScreen contentStyle={styles.page} topInset>
      <View style={styles.card}>
        <Feather name="credit-card" size={30} color={guest.purple} />
        <Text style={styles.title}>Plata vine în curând</Text>
        <Text style={styles.body}>
          Aici se va deschide Stripe Checkout. Momentan este doar un pas simulat — nu se face
          nicio plată reală.
        </Text>
        <Text style={styles.meta}>Eveniment: {id}</Text>
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
    backgroundColor: guest.white,
    borderRadius: gRadius.xl,
    padding: gSpace.xxl,
    alignItems: 'center',
    gap: gSpace.md,
    ...gShadow,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: guest.ink,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: guest.body,
    textAlign: 'center',
  },
  meta: {
    fontSize: 11,
    color: guest.faint,
  },
});
