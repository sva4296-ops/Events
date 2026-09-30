import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { EmptyState } from '@/components/EmptyState';
import { Button, buttonLabelColor } from '@/components/Button';
import { LockedFeature } from '@/components/guest/LockedFeature';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { PhotoTile } from '@/components/guest/PhotoTile';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useEventContent } from '@/hooks/useEventContent';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useTheme } from '@/hooks/useTheme';
import { guest } from '@/utils/guestTheme';
import { typography } from '@/utils/themeTokens';
import { buildLiveLink } from '@/utils/invite';

/**
 * Warm Story 2.0 Live: a themed card (LIVE tag, QR + copy, upload button)
 * over a three-column grid of every photo. The QR box stays white/navy in
 * both modes so it always scans.
 */
export default function LiveScreen() {
  const { t } = useTranslation();
  const { id, name, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, addPhoto, deletePhoto } = useEventContent(id);
  const { hydrated: planHydrated, capabilities } = usePlanGate(id);

  const owner = isOwner(event);

  const liveUrl = buildLiveLink(id);
  const loading = content === null;
  const photos = content?.photos ?? [];

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || asset === undefined) return;

    addPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  // Live isn't included in this event's current plan (Esențial). Client-side
  // only, by design — see the plan-feature-gating migration's header comment
  // on why the Live screen has no distinct server-side write to enforce (it
  // shares the `photos` table with Album, which is baseline-always-on).
  if (planHydrated && !capabilities.liveScreenEnabled) {
    return (
      <GuestScreen transparent>
        <LockedFeature kind="live" eventId={id} owner={owner} />
      </GuestScreen>
    );
  }

  return (
    <GuestScreen transparent>
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
          tokens.surfaceElevatedShadow ?? undefined,
        ]}
      >
        <View style={styles.cardHead}>
          <View style={styles.liveTag}>
            <View style={styles.recordDot} />
            <Text style={styles.liveText}>{t('live.liveTag')}</Text>
          </View>
          <Text style={[styles.count, { color: tokens.textSecondary }]} numberOfLines={1}>
            {loading ? name : t('live.photosCount', { count: photos.length })}
          </Text>
        </View>

        <View style={styles.qrRow}>
          <View style={styles.qr}>
            <QRCode value={liveUrl} size={84} backgroundColor={guest.white} color={guest.navy} />
          </View>
          <View style={styles.qrCopy}>
            <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>{t('live.cardTitle')}</Text>
            <Text style={[styles.cardBody, { color: tokens.textSecondary }]}>{t('live.cardBody')}</Text>
          </View>
        </View>

        <Button
          label={t('live.upload')}
          icon={<Feather name="upload" size={20} color={buttonLabelColor('primary', tokens)} />}
          onPress={() => void pickPhoto()}
        />
      </View>

      <Text style={[styles.gridTitle, { color: tokens.textPrimary }]}>{t('live.gridTitle')}</Text>

      {loading ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} width="32%" height={108} radius={12} />
          ))}
        </View>
      ) : photos.length === 0 ? (
        <EmptyState message={t('live.empty')} />
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              style={[styles.tile, { backgroundColor: tokens.surface2 }]}
              canDelete={owner || photo.uploaded_by === user?.id}
              onDelete={deletePhoto}
              labelFontSize={10}
            />
          ))}
        </View>
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#B5335F',
  },
  recordDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: '#FFFFFF',
  },
  count: {
    flex: 1,
    fontSize: 13,
  },
  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  qr: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: guest.white,
  },
  qrCopy: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    ...typography.title2,
    fontSize: 20,
    lineHeight: 25,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  gridTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tile: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
