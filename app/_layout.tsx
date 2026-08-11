import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_600SemiBold,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/components/AuthGate';
import { BrandSplash } from '@/components/BrandSplash';
import { AuthProvider } from '@/hooks/useAuth';
import { EventDraftProvider } from '@/hooks/useEventDraft';

/**
 * Mobile-tuned defaults: a short staleTime avoids a refetch on every screen
 * focus while a mutation's invalidateQueries() still forces a fresh read
 * immediately. Mutations never auto-retry — retrying a failed insert/update
 * against Supabase risks a duplicate write, unlike a read.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium_Italic,
    PlayfairDisplay_600SemiBold,
  });

  const [queryClient] = useState(createQueryClient);
  const [splashVisible, setSplashVisible] = useState(true);

  // Nothing to route here anymore — AuthGate decides Auth vs Onboarding vs
  // letting the default route (Home) through, once mounted underneath.
  const handleReveal = useCallback(() => {}, []);

  const handleFinished = useCallback(() => setSplashVisible(false), []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EventDraftProvider>
          <AuthGate>
            <StatusBar style="dark" />
            <View style={styles.root}>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FBF8FF' } }}
              />
              {splashVisible ? (
                <BrandSplash onReveal={handleReveal} onFinished={handleFinished} />
              ) : null}
            </View>
          </AuthGate>
        </EventDraftProvider>
      </AuthProvider>
      </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
