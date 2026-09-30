import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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

import { Button } from '@/components/Button';
import { StoryStages } from '@/components/StoryStages';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { typography } from '@/utils/themeTokens';

/**
 * Warm Story 2.0 onboarding: the four stages of an event's story, one per
 * slide. Titles/bodies are locale keys, not literal text, so this array stays
 * stable across a language change — including as React `key`s below.
 */
const STEPS = [
  { stageKey: 'onboarding.stageLaunch', titleKey: 'onboarding.step1Title', bodyKey: 'onboarding.step1Body' },
  { stageKey: 'onboarding.stageJourney', titleKey: 'onboarding.step2Title', bodyKey: 'onboarding.step2Body' },
  { stageKey: 'onboarding.stageDayX', titleKey: 'onboarding.step3Title', bodyKey: 'onboarding.step3Body' },
  { stageKey: 'onboarding.stageRecap', titleKey: 'onboarding.step4Title', bodyKey: 'onboarding.step4Body' },
] as const;

const { width } = Dimensions.get('window');
const ILLUSTRATION_WIDTH = Math.min(342, width - 48);

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const { markOnboardingComplete } = useAuth();
  const { tokens } = useTheme();

  const isLast = step === STEPS.length - 1;
  const stageLabels = [
    t('onboarding.stageLaunch'),
    t('onboarding.stageJourney'),
    t('onboarding.stageDayX'),
    t('onboarding.stageRecap'),
  ] as const;

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
    <LinearGradient colors={tokens.background} style={[styles.page, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.top}>
        <TouchableOpacity onPress={finish} activeOpacity={0.7} accessibilityRole="button" style={styles.skip}>
          <Text style={[styles.skipLabel, { color: tokens.textSecondary }]}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {STEPS.map((item, index) => (
          <View key={item.titleKey} style={[styles.slide, { width }]}>
            <View style={styles.illustration}>
              <StoryStages current={index} labels={stageLabels} width={ILLUSTRATION_WIDTH} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.overline, { color: tokens.accentText }]}>
                {t('onboarding.stageOverline', { step: index + 1, total: STEPS.length, name: t(item.stageKey) })}
              </Text>
              <Text style={[styles.title, { color: tokens.textPrimary }]}>{t(item.titleKey)}</Text>
              <Text style={[styles.body, { color: tokens.textSecondary }]}>{t(item.bodyKey)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View
          style={styles.dots}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}
        >
          {STEPS.map((item, index) => (
            <View
              key={item.stageKey}
              style={[
                styles.dot,
                index === step
                  ? { width: 26, backgroundColor: tokens.accentFill }
                  : { backgroundColor: tokens.border },
              ]}
            />
          ))}
        </View>

        <Button label={isLast ? t('onboarding.getStarted') : t('onboarding.next')} onPress={next} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  top: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  skip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  skipLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  illustration: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  copy: {
    paddingTop: 20,
    paddingHorizontal: 28,
    gap: 14,
  },
  overline: {
    ...typography.overline,
  },
  title: {
    ...typography.title1,
    fontSize: 30,
    lineHeight: 36,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
