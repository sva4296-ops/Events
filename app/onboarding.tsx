import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useTheme } from '@/hooks/useTheme';
import { fonts } from '@/utils/guestTheme';

/**
 * Titles/bodies are locale keys, not literal text, so this array stays stable
 * across a language change — including as React `key`s below, which must not
 * change when the active language does.
 */
const STEPS = [
  { icon: '💌', titleKey: 'onboarding.step1Title', bodyKey: 'onboarding.step1Body' },
  { icon: '🔗', titleKey: 'onboarding.step2Title', bodyKey: 'onboarding.step2Body' },
  { icon: '💜', titleKey: 'onboarding.step3Title', bodyKey: 'onboarding.step3Body' },
  { icon: '✨', titleKey: 'onboarding.step4Title', bodyKey: 'onboarding.step4Body' },
] as const;

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const { markOnboardingComplete } = useAuth();
  const { tokens } = useTheme();

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
    <View style={[styles.page, { paddingTop: insets.top + 20, backgroundColor: tokens.background[0] }]}>
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
          <View key={item.titleKey} style={[styles.slide, { width }]}>
            <View style={[styles.illustration, { backgroundColor: `${tokens.accentPrimary}22` }]}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>{t(item.titleKey)}</Text>
            <Text style={[styles.body, { color: tokens.textSecondary }]}>{t(item.bodyKey)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity onPress={finish} activeOpacity={0.7} accessibilityRole="button">
          <Text style={[styles.skip, { color: tokens.textSecondary }]}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.next, { backgroundColor: tokens.accentPrimary }]}
          onPress={next}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.nextLabel}>{isLast ? t('onboarding.getStarted') : t('onboarding.next')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
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
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
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
    paddingVertical: 12,
    paddingRight: 12,
  },
  next: {
    minHeight: 50,
    paddingHorizontal: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
