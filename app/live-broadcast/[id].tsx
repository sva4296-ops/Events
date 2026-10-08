import Feather from '@expo/vector-icons/Feather';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { invokeLiveStream } from '@/data/liveStreamRepository';
import { useEvents } from '@/hooks/useEvents';
import { reportSupabaseError } from '@/utils/reportError';
import { INVITE_SITE_URL } from '@/utils/whatsappInvite';

type Status = 'preparing' | 'connecting' | 'live' | 'error';

/**
 * Organizer broadcasts live video (demo). The camera runs in povestea-web's
 * /live/broadcast page inside a WebView (WebRTC/WHIP to Cloudflare Stream),
 * so there's no native streaming module. This screen gets the WHIP url from
 * the live-stream function, flips is_live, and owns Stop.
 */
export default function LiveBroadcastScreen() {
  useKeepAwake();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const allowed = isOwner(event);

  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('preparing');
  const liveRef = useRef(false);

  useEffect(() => {
    if (!allowed || id === undefined) return;
    let cancelled = false;

    const prepare = async () => {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        if (Object.values(result).some((value) => value !== PermissionsAndroid.RESULTS.GRANTED)) {
          throw new Error('camera_or_mic_denied');
        }
      }
      const url = await invokeLiveStream(id, 'start');
      if (url === null) throw new Error('no_whip_url');
      if (!cancelled) {
        setWhipUrl(url);
        setStatus('connecting');
      }
    };

    prepare().catch((err: unknown) => {
      reportSupabaseError(err);
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      // Leaving the screen ends the broadcast (the WebView closes with it).
      if (liveRef.current) {
        liveRef.current = false;
        invokeLiveStream(id, 'stop').catch((err: unknown) => reportSupabaseError(err));
      }
    };
  }, [allowed, id]);

  if (!allowed || id === undefined) {
    return (
      <Screen coverType={event?.type}>
        <Header title={t('common.notAvailable')} subtitle={t('liveVideo.notAvailable')} showBack />
      </Screen>
    );
  }

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { type?: string; message?: string } = {};
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      return;
    }
    if (message.type === 'live' && !liveRef.current) {
      liveRef.current = true;
      setStatus('live');
      invokeLiveStream(id, 'live').catch((err: unknown) => reportSupabaseError(err));
    } else if (message.type === 'error') {
      reportSupabaseError(new Error(`live broadcast: ${message.message ?? 'unknown'}`));
      setStatus('error');
    }
  };

  const statusLabel =
    status === 'live'
      ? t('liveVideo.statusLive')
      : status === 'error'
        ? t('liveVideo.statusError')
        : t('liveVideo.statusConnecting');

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={[styles.statusChip, status === 'live' && styles.statusLive]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        <TouchableOpacity
          style={styles.close}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('liveVideo.stop')}
        >
          <Feather name="x" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {whipUrl !== null ? (
        <WebView
          source={{ uri: `${INVITE_SITE_URL}/live/broadcast#whip=${encodeURIComponent(whipUrl)}` }}
          style={styles.fill}
          onMessage={onMessage}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          scrollEnabled={false}
          bounces={false}
        />
      ) : (
        <View style={styles.fill} />
      )}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button label={t('liveVideo.stop')} variant="danger" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusChip: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
  },
  statusLive: {
    backgroundColor: '#B5335F',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
});
