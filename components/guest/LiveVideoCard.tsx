import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/useTheme';
import { INVITE_SITE_URL } from '@/utils/whatsappInvite';

/**
 * The event's live video (WebRTC/WHEP), played by povestea-web's /live/watch
 * page inside a WebView. 16:9, rounded like the other Live cards.
 */
export function LiveVideoCard({ whepUrl }: { whepUrl: string }) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.frame, { borderColor: tokens.border }]}>
      <WebView
        source={{ uri: `${INVITE_SITE_URL}/live/watch#whep=${encodeURIComponent(whepUrl)}` }}
        style={styles.web}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 9,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  web: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
