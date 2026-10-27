import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { showDialog } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { CoverArt } from '@/components/CoverArt';
import { defaultCover } from '@/components/EventCover';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { AiQuotaError, suggestCoverTheme } from '@/data/aiRepository';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useTheme } from '@/hooks/useTheme';
import { AI_THEME_PLANS, COVER_THEMES, getCoverTheme, suggestedCoverTheme, type CoverTheme } from '@/utils/coverThemes';
import { daysUntilEvent, formatShortDate } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import i18n from '@/utils/i18n';
import { reportSupabaseError } from '@/utils/reportError';
import { wizardStep } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { themeRadius, typeface } from '@/utils/themeTokens';

type PreviewTab = 'invite' | 'feed' | 'link';

const ON_COVER = '#FFFFFF';
const ON_COVER_MUTED = 'rgba(255,255,255,0.85)';
const ON_LIGHT_COVER = '#2B2740';

/** "Alege tema": the cover shown on the invitation, in the feed and in the shared link. */
export default function PickThemeScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const step = wizardStep(draft.type, 'theme');
  const [tab, setTab] = useState<PreviewTab>('invite');
  const [aiBusy, setAiBusy] = useState(false);

  const suggested = suggestedCoverTheme(draft.type, draft.template);
  const canUseAi = AI_THEME_PLANS.includes(draft.planTier ?? '');

  // No pick = "Clasic": the app-themed default cover for this type.
  const classic = defaultCover(draft.type ?? 'other', tokens);
  const selected = getCoverTheme(draft.coverTheme) ?? classic;
  // Suggested first, then the rest in their usual order.
  const themes = [...COVER_THEMES].sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested));

  const pick = (id: string | null) => {
    haptics.tap();
    updateDraft({ coverTheme: id });
  };

  const pickWithAi = async () => {
    if (!canUseAi) {
      // Upgrade in place: the plan screen returns here once a plan is picked.
      router.push({ pathname: '/pricing/[id]', params: { id: 'draft', context: 'upgrade' } });
      return;
    }
    setAiBusy(true);
    try {
      const theme = await suggestCoverTheme({
        type: draft.type,
        name: draft.name.trim(),
        detail: draft.type === 'spontaneous' && draft.template !== null ? draft.template : undefined,
      });
      if (getCoverTheme(theme) !== null) {
        haptics.success();
        updateDraft({ coverTheme: theme });
      }
    } catch (error) {
      if (error instanceof AiQuotaError) {
        showDialog({ title: t('coverTheme.aiQuotaTitle'), message: t('coverTheme.aiQuotaBody') });
      } else {
        reportSupabaseError(error);
      }
    } finally {
      setAiBusy(false);
    }
  };

  const name = draft.name.trim().length > 0 ? draft.name.trim() : t('coverTheme.untitled');
  const date = draft.date.trim().length > 0 ? formatShortDate(draft.date) : '';
  const location = draft.location.trim();
  const days = draft.date.trim().length > 0 ? daysUntilEvent(draft.date) : null;
  const countdown =
    days === null || days < 0 ? null : days === 0 ? t('home.countdownToday') : t('home.countdown', { count: days });
  const parsedDate = new Date(draft.date);
  const shortDate =
    draft.date.trim().length > 0 && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
      : '';
  const textColor = selected.light ? ON_LIGHT_COVER : ON_COVER;
  const mutedColor = selected.light ? ON_LIGHT_COVER : ON_COVER_MUTED;
  const chipLabel =
    draft.type === 'spontaneous' && draft.template !== null
      ? t(`spontaneous.templates.${draft.template}.name`)
      : t(`eventTypes.${draft.type ?? 'other'}.label`);

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button label={t('coverTheme.back')} variant="secondary" onPress={() => router.back()} style={styles.back} />
          <Button label={t('createWizard.continue')} onPress={() => router.push('/create/preview')} style={styles.next} />
        </View>
      }
      contentStyle={styles.content}
    >
      <Header
        title={t('coverTheme.title')}
        subtitle={t('coverTheme.subtitle')}
        showBack
        onClose={cancel}
        flowTitle={t('createWizard.flowTitle')}
        stepLabel={t('createWizard.stepLabel', { ...step, name: t('createWizard.stepTheme') })}
        step={step.step}
        totalSteps={step.total}
      />

      <View style={[styles.segment, { backgroundColor: tokens.surface2 }]}>
        {(['invite', 'feed', 'link'] as const).map((key) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.segmentItem, active && { backgroundColor: tokens.surface }]}
            >
              <Text style={[styles.segmentText, { color: active ? tokens.textPrimary : tokens.textSecondary }]}>
                {t(`coverTheme.tab.${key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'invite' ? (
        <CoverArt theme={selected} style={styles.invitePreview}>
          <View style={styles.inviteText}>
            <View style={[styles.chip, { borderColor: mutedColor }]}>
              <Text style={[styles.chipText, { color: textColor }]}>{chipLabel}</Text>
            </View>
            <Text style={[styles.inviteName, { color: textColor, fontFamily: tokens.displayFont }]} numberOfLines={2}>
              {name}
            </Text>
            {date.length > 0 ? <Text style={[styles.inviteMeta, { color: mutedColor }]}>{date}</Text> : null}
            {location.length > 0 ? (
              <Text style={[styles.inviteMeta, { color: mutedColor }]} numberOfLines={1}>
                {location}
              </Text>
            ) : null}
          </View>
        </CoverArt>
      ) : tab === 'feed' ? (
        // Home's event card: cover with countdown, name and date over it, RSVP counts below.
        <View style={[styles.feedCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <CoverArt theme={selected} style={styles.feedCover}>
            {countdown !== null ? (
              <View style={[styles.countdownChip, { borderColor: mutedColor }]}>
                <Text style={[styles.countdownText, { color: textColor }]}>{countdown}</Text>
              </View>
            ) : null}
            <View style={styles.feedTitle}>
              <Text style={[styles.feedName, { color: textColor, fontFamily: tokens.displayFont }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.feedMeta, { color: mutedColor }]} numberOfLines={1}>
                {[date, location].filter((part) => part.length > 0).join(' · ')}
              </Text>
            </View>
          </CoverArt>
          <View style={styles.feedFooter}>
            <View style={[styles.countDot, { backgroundColor: tokens.statusConfirmed }]} />
            <Text style={[styles.feedCount, { color: tokens.textPrimary }]}>0 {t('home.confirmedCount')}</Text>
            <View style={[styles.countDot, { backgroundColor: tokens.statusPending }]} />
            <Text style={[styles.feedCount, { color: tokens.textPrimary }]}>0 {t('home.pendingCount')}</Text>
            <Text style={[styles.feedOpen, { color: tokens.accentText }]}>{t('home.open')} ›</Text>
          </View>
        </View>
      ) : (
        // The preview WhatsApp shows for the invitation link (a still image).
        <View style={styles.linkWrap}>
          <View style={[styles.linkBubble, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <CoverArt theme={selected} style={styles.linkCover}>
              <Text style={[styles.linkCoverName, { color: textColor, fontFamily: tokens.displayFont }]} numberOfLines={1}>
                {name}
              </Text>
            </CoverArt>
            <View style={styles.linkBody}>
              <Text style={[styles.linkTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.feedMeta, { color: tokens.textSecondary }]} numberOfLines={1}>
                {[t('coverTheme.linkInvited'), shortDate, location].filter((part) => part.length > 0).join(' · ')}
              </Text>
            </View>
          </View>
          <Text style={[styles.linkCaption, { color: tokens.textSecondary }]}>{t('coverTheme.linkCaption')}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={() => void pickWithAi()}
        disabled={aiBusy}
        activeOpacity={0.8}
        accessibilityRole="button"
        style={[styles.aiRow, { backgroundColor: tokens.accentTint, borderColor: tokens.border }]}
      >
        <Feather name={canUseAi ? 'zap' : 'lock'} size={18} color={tokens.accentText} />
        <View style={styles.aiText}>
          <Text style={[styles.aiTitle, { color: tokens.accentText }]}>
            {aiBusy ? t('coverTheme.aiBusy') : t('coverTheme.aiTitle')}
          </Text>
          <Text style={[styles.aiBody, { color: tokens.textSecondary }]}>
            {canUseAi ? t('coverTheme.aiBody') : t('coverTheme.aiLocked')}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={tokens.accentText} />
      </TouchableOpacity>

      <View style={styles.grid}>
        <ThemeTile
          theme={classic}
          label={t('coverTheme.classic')}
          selected={draft.coverTheme === null}
          suggested={false}
          onPress={() => pick(null)}
        />
        {themes.map((theme) => (
          <ThemeTile
            key={theme.id}
            theme={theme}
            label={t(`coverTheme.names.${theme.id}`)}
            selected={theme.id === selected.id}
            suggested={theme.id === suggested}
            onPress={() => pick(theme.id)}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: tokens.accentFill }]} />
        <Text style={[styles.legendText, { color: tokens.textSecondary }]}>
          {t('coverTheme.suggestedFor', { category: chipLabel })}
        </Text>
      </View>
    </Screen>
  );
}

function ThemeTile({
  theme,
  label,
  selected,
  suggested,
  onPress,
}: {
  theme: CoverTheme;
  label: string;
  selected: boolean;
  suggested: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.tile}
    >
      <View style={[styles.tileFrame, { borderColor: selected ? tokens.textPrimary : 'transparent' }]}>
        <CoverArt theme={theme} style={styles.tileArt}>
          {suggested ? <View style={[styles.suggestedDot, { backgroundColor: tokens.accentFill }]} /> : null}
        </CoverArt>
      </View>
      <Text
        style={[styles.tileLabel, { color: selected ? tokens.textPrimary : tokens.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  back: {
    flex: 1,
  },
  next: {
    flex: 1.4,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: themeRadius.pill,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: themeRadius.pill,
  },
  segmentText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
  },
  invitePreview: {
    aspectRatio: 1.25,
    borderRadius: themeRadius.xl,
    justifyContent: 'flex-end',
  },
  inviteText: {
    padding: spacing.lg,
    gap: 4,
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: themeRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  chipText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
  },
  inviteName: {
    fontSize: 32,
    lineHeight: 38,
  },
  inviteMeta: {
    fontFamily: typeface.bodyMedium,
    fontSize: 14,
  },
  feedCard: {
    borderRadius: themeRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  feedCover: {
    height: 170,
    justifyContent: 'flex-end',
  },
  countdownChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: themeRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countdownText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
  },
  feedTitle: {
    padding: spacing.md,
    gap: 2,
  },
  feedName: {
    fontSize: 24,
  },
  feedMeta: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
  feedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedCount: {
    fontFamily: typeface.body,
    fontSize: 13,
    marginRight: 8,
  },
  feedOpen: {
    marginLeft: 'auto',
    fontFamily: typeface.bodySemiBold,
    fontSize: 13,
  },
  linkWrap: {
    gap: 6,
  },
  linkBubble: {
    borderRadius: themeRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  linkCover: {
    aspectRatio: 1.9,
    justifyContent: 'flex-end',
  },
  linkCoverName: {
    fontSize: 26,
    padding: spacing.md,
  },
  linkBody: {
    padding: spacing.sm,
    gap: 2,
  },
  linkTitle: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
  },
  linkCaption: {
    fontFamily: typeface.body,
    fontSize: 12,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: themeRadius.md,
    padding: spacing.md,
  },
  aiText: {
    flex: 1,
    gap: 2,
  },
  aiTitle: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 15,
  },
  aiBody: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    columnGap: '4%',
  },
  tile: {
    width: '22%',
    gap: 6,
    alignItems: 'center',
  },
  tileFrame: {
    width: '100%',
    borderWidth: 2,
    borderRadius: 16,
    padding: 2,
  },
  tileArt: {
    aspectRatio: 1,
    borderRadius: 12,
  },
  suggestedDot: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tileLabel: {
    fontFamily: typeface.bodyMedium,
    fontSize: 12,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: typeface.body,
    fontSize: 12,
    marginRight: 8,
  },
});
