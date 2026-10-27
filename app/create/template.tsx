import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { CoverArt } from '@/components/CoverArt';
import { Header } from '@/components/Header';
import { ScaleTouchable } from '@/components/ScaleTouchable';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useTheme } from '@/hooks/useTheme';
import { getCoverTheme } from '@/utils/coverThemes';
import { haptics } from '@/utils/haptics';
import { getOuting, OUTINGS } from '@/utils/outings';
import { wizardStep } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { themeRadius, typeface } from '@/utils/themeTokens';

/** Spontaneous events only: the kind of outing. The activity (and with it the Plan tab's tool) comes next. */
export default function PickTemplateScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const { step, total } = wizardStep('spontaneous', 'template');

  // Preselect the first kind so Continue is never a dead button here.
  useEffect(() => {
    if (draft.outing === null) {
      const first = getOuting(null);
      updateDraft({ outing: first.id, template: first.template });
    }
  }, [draft.outing, updateDraft]);

  return (
    <Screen
      footer={
        <Button
          label={t('createWizard.continue')}
          disabled={draft.outing === null}
          onPress={() => router.push('/create/activity')}
        />
      }
    >
      <Header
        title={t('spontaneous.wizard.templateTitle')}
        subtitle={t('spontaneous.wizard.templateSubtitle')}
        showBack
        onClose={cancel}
        flowTitle={t('createWizard.flowTitle')}
        stepLabel={t('createWizard.stepLabel', { step, total, name: t('spontaneous.wizard.stepTemplate') })}
        step={step}
        totalSteps={total}
      />

      {/* Picture cards, like the type step: each kind's cover theme with its name over it. */}
      <View style={styles.list}>
        {OUTINGS.map((outing) => {
          const id = outing.id;
          const selected = draft.outing === id;
          const cover = getCoverTheme(outing.coverTheme)!;
          const ink = cover.light ? '#2B2740' : '#FFFFFF';
          return (
            <ScaleTouchable
              key={id}
              scaleTo={0.98}
              onPress={() => {
                haptics.tap();
                // A new kind resets the activity picked for the previous one.
                if (draft.outing !== id) {
                  updateDraft({ outing: id, template: outing.template, activity: null, coverTheme: null });
                }
              }}
              activeOpacity={0.9}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={t(`spontaneous.outings.${id}.name`)}
              style={[
                styles.card,
                { backgroundColor: tokens.surface, borderColor: selected ? tokens.accentFill : tokens.border },
                selected && styles.cardSelected,
              ]}
            >
              <CoverArt theme={cover} style={styles.cover}>
                <View style={styles.coverInner}>
                  <Feather name={outing.icon} size={18} color={ink} />
                  <Text style={[styles.name, { color: ink, fontFamily: tokens.displayFont }]}>
                    {t(`spontaneous.outings.${id}.name`)}
                  </Text>
                </View>
                {selected ? (
                  <View style={[styles.check, { backgroundColor: tokens.accentFill }]}>
                    <Feather name="check" size={14} color={tokens.onAccent} />
                  </View>
                ) : null}
              </CoverArt>
              <View style={styles.body}>
                <Text style={[styles.description, { color: tokens.textPrimary }]}>
                  {t(`spontaneous.outings.${id}.description`)}
                </Text>
                <Text style={[styles.includes, { color: tokens.textMuted }]}>{t(`spontaneous.outings.${id}.features`)}</Text>
              </View>
            </ScaleTouchable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: themeRadius.xl,
    overflow: 'hidden',
  },
  cardSelected: {
    borderWidth: 2,
  },
  cover: {
    height: 104,
  },
  coverInner: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  name: {
    fontSize: 24,
    lineHeight: 28,
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  description: {
    fontFamily: typeface.body,
    fontSize: 14,
    lineHeight: 19,
  },
  includes: {
    fontFamily: typeface.body,
    fontSize: 12,
  },
});
