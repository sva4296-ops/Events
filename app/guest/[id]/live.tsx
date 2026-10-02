import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { LiveVideoCard } from '@/components/guest/LiveVideoCard';
import { LockedFeature } from '@/components/guest/LockedFeature';
import { fetchLiveShareToken } from '@/data/liveStreamRepository';
import { useAppSetting } from '@/hooks/useAppSetting';
import { useEventStream } from '@/hooks/useEventStream';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useTheme } from '@/hooks/useTheme';
import { reportSupabaseError } from '@/utils/reportError';
import { typography } from '@/utils/themeTokens';
import { INVITE_SITE_URL } from '@/utils/whatsappInvite';

const LIVE_RED = '#B5335F';

/**
 * Live: only the live video (organizer broadcasts, see
 * app/live-broadcast/[id].tsx). Photo uploads live in the Album tab.
 * Layout: 16:9 screen (video, or an offline placeholder), short copy, then
 * the organizer's actions.
 */
export default function LiveScreen() {
  const { t } = useTranslation();
  const { id, name, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { hydrated: planHydrated, capabilities } = usePlanGate(id);
  // Kill switch: app_settings.live_video in the Supabase dashboard (no release needed).
  const liveVideoEnabled = useAppSetting('live_video');
  // No polling while off: the table may not even exist yet.
  const { data: stream } = useEventStream(liveVideoEnabled ? id : undefined);

  const owner = isOwner(event);
  const whepUrl = stream?.isLive === true ? stream.whepUrl : null;

  // Public link for people who aren't at the event (browser, no account).
  const shareLiveLink = async () => {
    try {
      const token = await fetchLiveShareToken(id);
      await Share.share({
        message: t('liveVideo.shareMessage', { name, url: `${INVITE_SITE_URL}/w/${token}` }),
      });
    } catch (err) {
      reportSupabaseError(err);
    }
  };

  // Coming soon: same frame as the real screen, no actions, no plan upsell.
  if (!liveVideoEnabled) {
    return (
      <GuestScreen transparent>
        <View style={styles.wrap}>
          <View style={[styles.screen, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <View style={[styles.offline, { backgroundColor: tokens.accentTint }]}>
              <Text style={[styles.offlineText, { color: tokens.accentText }]}>{t('liveVideo.soonTag')}</Text>
            </View>
            <View style={[styles.halo, { backgroundColor: tokens.accentTint }]}>
              <Feather name="video" size={30} color={tokens.accentText} />
            </View>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('liveVideo.soonTitle')}</Text>
            <Text style={[styles.body, { color: tokens.textSecondary }]}>{t('liveVideo.soonBody')}</Text>
          </View>
        </View>
      </GuestScreen>
    );
  }

  // Client-side gate only (usePlanGate); see the plan-feature-gating migration.
  if (planHydrated && !capabilities.liveScreenEnabled) {
    return (
      <GuestScreen transparent>
        <LockedFeature kind="live" eventId={id} owner={owner} />
      </GuestScreen>
    );
  }

  const title =
    whepUrl !== null ? t('liveVideo.titleLive') : owner ? t('liveVideo.titleOwner') : t('liveVideo.titleIdle');
  const body =
    whepUrl !== null ? null : owner ? t('liveVideo.bodyOwner') : t('liveVideo.bodyIdle');

  return (
    <GuestScreen transparent>
      <View style={styles.wrap}>
        {whepUrl !== null ? (
          <LiveVideoCard whepUrl={whepUrl} />
        ) : (
          <View style={[styles.screen, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <View style={[styles.offline, { backgroundColor: tokens.surface2 }]}>
              <View style={[styles.dot, { backgroundColor: tokens.textMuted }]} />
              <Text style={[styles.offlineText, { color: tokens.textSecondary }]}>{t('liveVideo.offline')}</Text>
            </View>
            <View style={[styles.halo, { backgroundColor: tokens.accentTint }]}>
              <Feather name="video" size={30} color={tokens.accentText} />
            </View>
          </View>
        )}

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            {whepUrl !== null ? (
              <View style={styles.liveChip}>
                <View style={[styles.dot, styles.dotLive]} />
                <Text style={styles.liveChipText}>LIVE</Text>
              </View>
            ) : null}
            <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
          </View>
          {body !== null ? <Text style={[styles.body, { color: tokens.textSecondary }]}>{body}</Text> : null}
        </View>

        {owner && whepUrl === null ? (
          <Button
            label={t('liveVideo.start')}
            icon={<Feather name="video" size={20} color={buttonLabelColor('primary', tokens)} />}
            onPress={() => router.push(`/live-broadcast/${id}`)}
          />
        ) : null}

        {owner ? (
          <TouchableOpacity
            style={[styles.shareCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            onPress={() => void shareLiveLink()}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <View style={[styles.shareIcon, { backgroundColor: tokens.accentTint }]}>
              <Feather name="share-2" size={18} color={tokens.accentText} />
            </View>
            <View style={styles.shareCopy}>
              <Text style={[styles.shareTitle, { color: tokens.textPrimary }]}>{t('liveVideo.shareTitle')}</Text>
              <Text style={[styles.shareBody, { color: tokens.textSecondary }]}>{t('liveVideo.shareBody')}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
  },
  screen: {
    aspectRatio: 16 / 9,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offline: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotLive: {
    backgroundColor: '#FFFFFF',
  },
  halo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: LIVE_RED,
  },
  liveChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: '#FFFFFF',
  },
  title: {
    ...typography.title2,
    fontSize: 24,
    lineHeight: 29,
    flexShrink: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  shareIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCopy: {
    flex: 1,
    gap: 2,
  },
  shareTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  shareBody: {
    fontSize: 13,
    lineHeight: 18,
  },
});
