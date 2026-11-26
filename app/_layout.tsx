// Side-effect import — initializes i18next before anything below renders.
import "@/utils/i18n";

// Per-weight subpaths, so only these four font files are bundled.
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { InstrumentSans_400Regular } from "@expo-google-fonts/instrument-sans/400Regular";
import { InstrumentSans_500Medium } from "@expo-google-fonts/instrument-sans/500Medium";
import { InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans/600SemiBold";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CormorantGaramond_500Medium } from "@expo-google-fonts/cormorant-garamond/500Medium";
import { Fraunces_400Regular } from "@expo-google-fonts/fraunces/400Regular";
import { Lora_400Regular } from "@expo-google-fonts/lora/400Regular";
import { Lora_700Bold } from "@expo-google-fonts/lora/700Bold";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/components/AuthGate";
import { BrandSplash } from "@/components/BrandSplash";
import { ActionSheetHost } from "@/components/ActionSheet";
import { BusyOverlayHost } from "@/components/BusyOverlay";
import { TourHost } from "@/components/tour/Tour";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useEvents } from "@/hooks/useEvents";
import { EventDraftProvider } from "@/hooks/useEventDraft";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { useUserProfile } from "@/hooks/useUserProfile";
import { markAppReady } from "@/utils/appReady";
import { initSentry, wrapRoot } from "@/utils/sentry";

/**
 * Keeps the native splash (app.json's `expo-splash-screen` config) up past its normal
 * auto-hide point until `SplashGate` hides it, with BrandSplash already mounted
 * underneath, pixel-identical. Module scope so this runs before the first render.
 */
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

// No-op until EXPO_PUBLIC_SENTRY_DSN is set (see utils/sentry.ts).
initSentry();

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

function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    // Per-theme display fonts (utils/themeTokens.ts THEMES).
    Fraunces_400Regular,
    Lora_400Regular,
    Lora_700Bold,
    Newsreader_400Regular,
    CormorantGaramond_500Medium,
  });

  const [queryClient] = useState(createQueryClient);
  const [splashVisible, setSplashVisible] = useState(true);
  const handleSplashFinished = useCallback(() => {
    setSplashVisible(false);
    markAppReady();
  }, []);
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <EventDraftProvider>
                <AuthGate>
                  <AppShell splashVisible={splashVisible} onSplashFinished={handleSplashFinished} />
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
  onSplashFinished,
}: {
  splashVisible: boolean;
  onSplashFinished: () => void;
}) {
  const { mode, tokens } = useTheme();

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.background[0] },
          }}
        />
        <TourHost />
        <ActionSheetHost />
        <BusyOverlayHost />
        {splashVisible ? <SplashGate onFinished={onSplashFinished} /> : null}
      </View>
    </>
  );
}

/** Never hold the splash longer than this (slow network, offline). */
const SPLASH_MAX_WAIT_MS = 5000;

/**
 * Rendering the first screen keeps the JS thread busy on a mid-range phone, which
 * froze BrandSplash halfway through its animation. So the native splash stays up
 * through that work, and the animation starts only afterwards.
 */
function SplashGate({ onFinished }: { onFinished: () => void }) {
  const { loading } = useAuth();
  const { hydrated: profileHydrated } = useUserProfile();
  const { hydrated: eventsHydrated } = useEvents();
  const [timedOut, setTimedOut] = useState(false);
  const [ready, setReady] = useState(false);
  const contentReady = (!loading && profileHydrated && eventsHydrated) || timedOut;

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), SPLASH_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!contentReady) return;
    // Two frames: the screen that just got its data has committed and painted.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void SplashScreen.hideAsync()
          .catch(() => undefined)
          .then(() => setReady(true));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [contentReady]);

  return <BrandSplash ready={ready} onFinished={onFinished} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default wrapRoot(RootLayout);
