import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing } from '@/utils/theme';

export default function ProfileScreen() {
  const { user, mode, signOut } = useAuth();

  return (
    <Screen
      footer={
        mode === 'supabase' && user !== null ? (
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        ) : undefined
      }
    >
      <Header title="Account" subtitle="Your session and app details." showBack />

      <Card>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Feather name="user" size={20} color={colors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.email}>{user?.email ?? 'Local account'}</Text>
            <Text style={styles.meta}>
              {mode === 'supabase' ? 'Signed in with Supabase' : 'Local device account'}
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  email: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
  },
});
