import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { ScaleTouchable } from '@/components/ScaleTouchable';
import type { AppEvent } from '@/types/event';
import { EVENT_COVERS } from '@/utils/eventCovers';
import { themeRadius, typeface, typography } from '@/utils/themeTokens';

/** "The story is ready" card: opens the post-event story (app/story/[id].tsx). */
export function StoryEntryCard({ event }: { event: AppEvent }) {
  const { t } = useTranslation();

  return (
    <ScaleTouchable
      scaleTo={0.98}
      onPress={() => router.push(`/story/${event.id}`)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={t('story.entryCta')}
      style={styles.card}
    >
      <ImageBackground source={EVENT_COVERS[event.type]} style={styles.image} resizeMode="cover">
        <LinearGradient colors={['rgba(15,12,28,0.15)', 'rgba(15,12,28,0.82)']} style={styles.veil}>
          <View style={styles.badge}>
            <Feather name="play" size={14} color="#1E1A30" />
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{t('story.entryTitle')}</Text>
            <Text style={styles.body}>{t('story.entryBody')}</Text>
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{t('story.entryCta')}</Text>
            <Feather name="chevron-right" size={16} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </ImageBackground>
    </ScaleTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.xxl,
    overflow: 'hidden',
  },
  image: {
    minHeight: 168,
  },
  veil: {
    flex: 1,
    padding: 18,
    gap: 10,
    justifyContent: 'flex-end',
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    gap: 4,
  },
  title: {
    ...typography.title2,
    color: '#FFFFFF',
  },
  body: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ctaText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
