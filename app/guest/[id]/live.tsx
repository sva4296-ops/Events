import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { PhotoTile } from '@/components/guest/PhotoTile';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useEventContent } from '@/hooks/useEventContent';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import { fonts, guest, gRadius, gSpace } from '@/utils/guestTheme';
import { buildInviteLink } from '@/utils/invite';

/**
 * Live's hero card is a deliberate, fixed "night broadcast" dark surface —
 * not the app's light/dark theme. It stays guest.navy/guest.white regardless
 * of the active theme, same as before this pass; only the page chrome around
 * it (helper text) reads from useTheme().
 */
export default function LiveScreen() {
  const { t } = useTranslation();
  const { id, name, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, addPhoto, deletePhoto } = useEventContent(id);

  const owner = isOwner(event);

  const liveUrl = buildInviteLink(id);
  const loading = content === null;
  const photos = content?.photos ?? [];
  const [hero, ...rest] = photos;

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || asset === undefined) return;

    addPhoto(asset.uri);
  };

  return (
    <GuestScreen transparent>
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.liveTag}>
            <View style={styles.recordDot} />
            <Text style={styles.liveText}>{t('live.liveTag')}</Text>
          </View>
          <Text style={styles.eventName} numberOfLines={1}>
            {name}
          </Text>
        </View>

        <View style={styles.grid}>
          {loading ? (
            <Skeleton height={140} radius={gRadius.md} />
          ) : hero !== undefined ? (
            <PhotoTile
              photo={hero}
              style={styles.hero}
              canDelete={owner || hero.uploaded_by === user?.id}
              onDelete={deletePhoto}
            />
          ) : (
            <View style={[styles.hero, styles.placeholder]} />
          )}

          {loading ? (
            <View style={styles.small}>
              <Skeleton width={56} height={56} radius={gRadius.sm} />
              <Skeleton width={56} height={56} radius={gRadius.sm} />
              <Skeleton width={56} height={56} radius={gRadius.sm} />
            </View>
          ) : null}

          {!loading && rest.length > 0 ? (
            <ScrollView
              style={styles.thumbScroll}
              contentContainerStyle={styles.small}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {rest.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  style={styles.thumb}
                  canDelete={owner || photo.uploaded_by === user?.id}
                  onDelete={deletePhoto}
                  labelFontSize={11}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.qrBlock}>
          <View style={styles.qr}>
            <QRCode value={liveUrl} size={78} backgroundColor={guest.white} color={guest.navy} />
          </View>
          <View style={styles.qrCopy}>
            <Text style={styles.qrTitle}>{t('live.qrTitle')}</Text>
            <Text style={styles.qrUrl} numberOfLines={2}>
              {liveUrl}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.helper, { color: tokens.textSecondary }]}>{t('live.helper')}</Text>

      <GuestButton label={t('live.addPhoto')} onPress={() => void pickPhoto()} />
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: guest.navy,
    borderRadius: gRadius.xl,
    padding: gSpace.xl,
    gap: gSpace.lg,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: gSpace.md,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.sm,
  },
  recordDot: {
    width: 9,
    height: 9,
    borderRadius: gRadius.pill,
    backgroundColor: guest.live,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: guest.white,
  },
  eventName: {
    flexShrink: 1,
    fontFamily: fonts.displayItalic,
    fontSize: 16,
    color: guest.white,
    textAlign: 'right',
  },
  grid: {
    gap: gSpace.sm,
  },
  hero: {
    width: '100%',
    height: 140,
    borderRadius: gRadius.md,
    backgroundColor: guest.navySoft,
  },
  placeholder: {
    backgroundColor: guest.navySoft,
  },
  // Bounded so the dark card can't grow unbounded — browse the rest by
  // scrolling this strip instead of the old hard 4-photo cap.
  thumbScroll: {
    maxHeight: 190,
  },
  small: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gSpace.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: gRadius.sm,
    backgroundColor: guest.navySoft,
  },
  qrBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.lg,
    backgroundColor: guest.navySoft,
    borderRadius: gRadius.md,
    padding: gSpace.lg,
  },
  qr: {
    padding: gSpace.sm,
    borderRadius: gRadius.sm,
    backgroundColor: guest.white,
  },
  qrCopy: {
    flex: 1,
    gap: gSpace.xs,
  },
  qrTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: guest.white,
  },
  qrUrl: {
    fontSize: 11,
    color: guest.faint,
  },
  helper: {
    fontSize: 13,
    textAlign: 'center',
  },
});
