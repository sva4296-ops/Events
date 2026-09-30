import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useTheme } from '@/hooks/useTheme';
import type { PlanCapabilities } from '@/types/pricing';
import { typography } from '@/utils/themeTokens';

type LockedKind = 'fond' | 'chat' | 'live';

const FLAG: Record<LockedKind, keyof PlanCapabilities> = {
  fond: 'contributionsEnabled',
  chat: 'chatEnabled',
  live: 'liveScreenEnabled',
};

const ICON: Record<LockedKind, keyof typeof Feather.glyphMap> = {
  fond: 'gift',
  chat: 'message-circle',
  live: 'radio',
};

/**
 * Warm Story 2.0 "Funcție blocată": what the feature does, which plan
 * unlocks it (the cheapest plan_features row with that flag on), and for the
 * organizer the way to that plan. Guests only get the explanation.
 */
export function LockedFeature({ kind, eventId, owner }: { kind: LockedKind; eventId: string; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { plans } = usePlanFeatures();

  const unlocking = [...plans]
    .filter((plan) => !plan.isNavigationOnly && plan[FLAG[kind]] === true)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const planName = unlocking?.displayName ?? 'Premium';
  const bullets = t(`planGate.${kind}Bullets`, { returnObjects: true }) as unknown;
  const bulletList = Array.isArray(bullets) ? (bullets as string[]) : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={[styles.halo, { backgroundColor: tokens.accentTint }]}>
          <View style={[styles.iconCircle, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Feather name={ICON[kind]} size={34} color={tokens.accentText} />
          </View>
        </View>
        <View style={[styles.planBadge, { backgroundColor: tokens.accentGold }]}>
          <Feather name="star" size={12} color="#2B2740" />
          <Text style={styles.planBadgeText}>{planName}</Text>
        </View>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>
          {t(`planGate.${kind}Title`, { plan: planName })}
        </Text>
        <Text style={[styles.body, { color: tokens.textSecondary }]}>{t(`planGate.${kind}Body`)}</Text>
      </View>

      {bulletList.length > 0 ? (
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          {bulletList.map((bullet) => (
            <View key={bullet} style={styles.bullet}>
              <View style={[styles.check, { backgroundColor: tokens.statusConfirmedSoft }]}>
                <Feather name="check" size={14} color={tokens.statusConfirmed} />
              </View>
              <Text style={[styles.bulletText, { color: tokens.textPrimary }]}>{bullet}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {owner ? (
        <>
          <Button
            label={t('planGate.upgradeTo', { plan: planName })}
            icon={<Feather name="star" size={20} color={buttonLabelColor('primary', tokens)} />}
            onPress={() => router.push(`/pricing/${eventId}`)}
          />
          <TouchableOpacity
            onPress={() => router.push(`/pricing/${eventId}`)}
            style={styles.link}
            accessibilityRole="link"
          >
            <Text style={[styles.linkText, { color: tokens.accentText }]}>{t('planGate.seeAllPlans')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={[styles.note, { color: tokens.textSecondary }]}>{t('planGate.askOrganizer')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
    paddingTop: 12,
  },
  hero: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 8,
  },
  halo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2B2740',
  },
  title: {
    ...typography.title2,
    fontSize: 26,
    lineHeight: 31,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
  },
  link: {
    alignSelf: 'center',
    padding: 12,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
