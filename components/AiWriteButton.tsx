import Feather from '@expo/vector-icons/Feather';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { showDialog } from '@/components/ActionSheet';
import { aiWrite, AiQuotaError, fetchAiEventUsage, type AiWriteContext, type AiWriteKind } from '@/data/aiRepository';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { eventAiLimit, isUnlimitedAi } from '@/utils/aiLimits';
import { haptics } from '@/utils/haptics';
import { captureError } from '@/utils/sentry';
import { themeRadius } from '@/utils/themeTokens';

interface AiWriteButtonProps {
  kind: AiWriteKind;
  value: string;
  onChange: (text: string) => void;
  context: AiWriteContext;
  maxChars: number;
  /** Only works on existing text (e.g. venue notes: tidy, never invent). Hidden while empty. */
  requireText?: boolean;
  /** Existing event: counts against its plan's AI allowance and shows what's left. */
  eventId?: string;
}

/**
 * Small "Scrie cu AI" / "Îmbunătățește" pill for a Field's `action` slot.
 * Empty field = write from the event's details; text = improve it. After a
 * replacement it turns into "Anulează" until the text is edited again.
 */
export function AiWriteButton({ kind, value, onChange, context, maxChars, requireText = false, eventId }: AiWriteButtonProps) {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ previous: string; applied: string } | null>(null);
  const queryClient = useQueryClient();
  const { getEvent } = useEvents();
  const planTier = eventId !== undefined ? (getEvent(eventId)?.planTier ?? null) : null;
  const usage = useQuery({
    queryKey: ['aiEventUsage', eventId],
    queryFn: () => fetchAiEventUsage(eventId!),
    enabled: eventId !== undefined,
    staleTime: 60_000,
  });
  // Shown only for metered plans; Premium reads as unlimited.
  const left =
    eventId !== undefined && usage.data !== undefined && !isUnlimitedAi(planTier)
      ? Math.max(eventAiLimit(planTier) - usage.data, 0)
      : null;

  const hasText = value.trim().length > 0;
  if (requireText && !hasText && undo === null) return null;

  // Still showing what the AI wrote: offer to go back, next to "improve" again.
  const showingAi = undo !== null && value === undo.applied;
  const label = requireText ? t('ai.tidy') : hasText ? t('ai.improve') : t('ai.write');

  const run = async () => {
    if (busy) return;
    haptics.tap();
    setBusy(true);
    try {
      const text = await aiWrite({
        kind,
        language: i18n.language.startsWith('en') ? 'en' : 'ro',
        text: value,
        maxChars,
        context,
        eventId,
      });
      // Undo always goes back to the organizer's own text, even after several rewrites.
      setUndo((current) => ({ previous: current !== null && value === current.applied ? current.previous : value, applied: text }));
      onChange(text);
    } catch (error) {
      if (error instanceof AiQuotaError && error.scope === 'event' && eventId !== undefined) {
        showDialog({
          title: t('ai.eventQuotaTitle'),
          message: t('ai.eventQuotaBody'),
          buttons: [
            { label: t('common.cancel'), style: 'cancel' },
            { label: t('ai.upgrade'), onPress: () => router.push(`/pricing/${eventId}`) },
          ],
        });
      } else if (error instanceof AiQuotaError) {
        showDialog({ title: t('ai.quotaTitle'), message: t('ai.quotaBody') });
      } else {
        captureError(error, { where: 'AiWriteButton', kind });
        // In dev builds the technical code is appended, to tell a bad key from a missing deploy.
        const detail = __DEV__ && error instanceof Error ? `\n\n(${error.message})` : '';
        showDialog({ title: t('common.somethingWentWrong'), message: `${t('ai.errorBody')}${detail}` });
      }
    } finally {
      setBusy(false);
      if (eventId !== undefined) void queryClient.invalidateQueries({ queryKey: ['aiEventUsage', eventId] });
    }
  };

  const runButton = (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: tokens.accentTint, borderColor: tokens.accentTint }]}
      onPress={() => void run()}
      disabled={busy}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={tokens.accentText} />
      ) : (
        <Feather name="feather" size={13} color={tokens.accentText} />
      )}
      <Text style={[styles.label, { color: tokens.accentText }]}>{busy ? t('ai.writing') : left !== null ? t('ai.withLeft', { label, count: left }) : label}</Text>
    </TouchableOpacity>
  );

  if (!showingAi) return runButton;
  return (
    <View style={styles.pair}>
      <TouchableOpacity
        style={[styles.pill, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
        onPress={() => {
          onChange(undo.previous);
          setUndo(null);
        }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('ai.undo')}
      >
        <Feather name="rotate-ccw" size={13} color={tokens.textSecondary} />
        <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('ai.undo')}</Text>
      </TouchableOpacity>
      {runButton}
    </View>
  );
}

const styles = StyleSheet.create({
  pair: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
