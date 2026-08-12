// Side-effect import — initializes i18next before anything below renders.
import '@/utils/i18n';

import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_600SemiBold,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/components/AuthGate';
import { BrandSplash } from '@/components/BrandSplash';
import { AuthProvider } from '@/hooks/useAuth';
import { EventDraftProvider } from '@/hooks/useEventDraft';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';

/**
 * Keeps the native splash (app.json's `expo-splash-screen` plugin config, with
 * its own light/dark `backgroundColor`) on screen past its normal auto-hide
 * point, until `RootLayout` explicitly hides it once fonts are ready and the
 * theme-aware BrandSplash overlay is already mounted underneath — so the
 * handoff is a clean cut, not a blank/wrong-background frame in between.
 * Module scope so this runs before the first render, not inside an effect.
 */
void SplashScreen.preventAutoHideAsync();

/**
 * Baseline only — every query below overrides staleTime (and gcTime where it
 * should differ) for its own data-freshness category; see hooks/useEvents.tsx
 * and hooks/useEventContent.tsx. `refetchOnWindowFocus` is a browser-tab
 * concept with no RN equivalent, so it's off rather than silently inert.
 * Mutations never auto-retry — retrying a failed insert/update against
 * Supabase risks a duplicate write, unlike a read.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: 2,
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

  // Fires once, right as this component is about to render BrandSplash for
  // the first time — hides the native splash at exactly the moment the
  // theme-aware JS one is ready to be seen in its place.
  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
      <ThemeProvider>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EventDraftProvider>
          <AuthGate>
            <AppShell splashVisible={splashVisible} onReveal={handleReveal} onFinished={handleFinished} />
          </AuthGate>
        </EventDraftProvider>
      </AuthProvider>
      </QueryClientProvider>
      </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Split out from RootLayout so it can call useTheme() — the provider has to
 * be an ancestor, not a sibling, of anything reading theme tokens.
 */
function AppShell({
  splashVisible,
  onReveal,
  onFinished,
}: {
  splashVisible: boolean;
  onReveal: () => void;
  onFinished: () => void;
}) {
  const { mode, tokens } = useTheme();

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.background[0] },
          }}
        />
        {splashVisible ? <BrandSplash onReveal={onReveal} onFinished={onFinished} /> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
