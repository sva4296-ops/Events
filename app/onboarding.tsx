import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { SegmentedProgress } from '@/components/SegmentedProgress';
import { useAuth } from '@/hooks/useAuth';
import { brand, fonts } from '@/utils/guestTheme';

const STEPS = [
  {
    icon: '💌',
    title: 'Creează pagina evenimentului',
    body: 'Alege tipul, adaugă detaliile și povestea voastră prinde formă în câteva minute.',
  },
  {
    icon: '🔗',
    title: 'Invită prin link sau cod QR',
    body: 'Trimiți invitația oriunde — pe WhatsApp, prin mesaj sau tipărită cu un cod QR.',
  },
  {
    icon: '💜',
    title: 'Invitații confirmă și contribuie',
    body: 'Vezi în timp real cine vine și primești contribuții pentru fondul vostru.',
  },
  {
    icon: '✨',
    title: 'Totul într-un singur loc',
    body: 'Program, poze live, chat și album — toată povestea, la îndemâna tuturor.',
  },
] as const;

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const { markOnboardingComplete } = useAuth();

  const isLast = step === STEPS.length - 1;

  const finish = () => {
    void markOnboardingComplete();
    // Reached only after a session already exists — see components/AuthGate.tsx.
    router.replace('/');
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (step + 1) * width, animated: true });
    setStep(step + 1);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setStep(Math.min(STEPS.length - 1, Math.max(0, index)));
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + 20 }]}>
      <View style={styles.brand}>
        <BrandHeader size="sm" />
      </View>

      <View style={styles.progress}>
        <SegmentedProgress total={STEPS.length} current={step} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {STEPS.map((item) => (
          <View key={item.title} style={[styles.slide, { width }]}>
            <View style={styles.illustration}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity onPress={finish} activeOpacity={0.7} accessibilityRole="button">
          <Text style={styles.skip}>Sari peste</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.next}
          onPress={next}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.nextLabel}>{isLast ? 'Începe' : 'Mai departe'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: brand.cream,
  },
  brand: {
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  progress: {
    paddingHorizontal: 24,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 14,
  },
  illustration: {
    width: 132,
    height: 132,
    borderRadius: 999,
    backgroundColor: brand.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    lineHeight: 29,
    color: brand.navy,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: brand.muted,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  skip: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.muted,
    paddingVertical: 12,
    paddingRight: 12,
  },
  next: {
    minHeight: 50,
    paddingHorizontal: 34,
    borderRadius: 999,
    backgroundColor: brand.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
