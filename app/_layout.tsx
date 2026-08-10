import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_600SemiBold,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate } from '@/components/AuthGate';
import { BrandSplash } from '@/components/BrandSplash';
import { AuthProvider } from '@/hooks/useAuth';
import { EventContentProvider } from '@/hooks/useEventContent';
import { EventDraftProvider } from '@/hooks/useEventDraft';
import { EventsProvider } from '@/hooks/useEvents';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium_Italic,
    PlayfairDisplay_600SemiBold,
  });

  const [splashVisible, setSplashVisible] = useState(true);

  // Nothing to route here anymore — AuthGate decides Auth vs Onboarding vs
  // letting the default route (Home) through, once mounted underneath.
  const handleReveal = useCallback(() => {}, []);

  const handleFinished = useCallback(() => setSplashVisible(false), []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
      <AuthProvider>
        <EventsProvider>
          <EventContentProvider>
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
          </EventContentProvider>
        </EventsProvider>
      </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
