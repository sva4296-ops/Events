import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import {
  MARK_PATH,
  MARK_STOPS,
  MARK_STROKE_LENGTH,
  MARK_VIEWBOX,
} from '@/utils/brandMark';
import { fonts } from '@/utils/guestTheme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const STROKE_LENGTH = MARK_STROKE_LENGTH;

const DRAW_DELAY = 150;
const DRAW_DURATION = 1200;
const WORDMARK_DURATION = 400;
const FADE_OUT_DURATION = 320;

interface BrandSplashProps {
  /** Fires when the sequence ends, before the fade — the parent routes here. */
  onReveal: () => void;
  /** Fires once the overlay has fully faded out and can be unmounted. */
  onFinished: () => void;
}

/**
 * Theme-aware: reads `useTheme()` for its background gradient and wordmark
 * colors, same as every other themed screen — resolves correctly on this
 * component's very first render (system scheme is synchronous; an explicit
 * in-app override only differs for one render tick while AsyncStorage
 * resolves, see hooks/useTheme.tsx and CLAUDE.md). The mark's own gold→pink→
 * purple stroke gradient is brand identity, not UI chrome, so it stays fixed
 * regardless of theme — same reasoning BrandMark.tsx already uses.
 */
export function BrandSplash({ onReveal, onFinished }: BrandSplashProps) {
  const { tokens } = useTheme();
  const draw = useRef(new Animated.Value(STROKE_LENGTH)).current;
  const goldDot = useRef(new Animated.Value(0)).current;
  const purpleDot = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const sequence = Animated.sequence([
      Animated.timing(goldDot, {
        toValue: 1,
        duration: 220,
        delay: DRAW_DELAY,
        useNativeDriver: true,
      }),
      // SVG props can't run on the native driver.
      Animated.timing(draw, {
        toValue: 0,
        duration: DRAW_DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(purpleDot, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(wordmark, {
        toValue: 1,
        duration: WORDMARK_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (!finished) return;
      onReveal();
      Animated.timing(overlay, {
        toValue: 0,
        duration: FADE_OUT_DURATION,
        useNativeDriver: true,
      }).start(() => onFinished());
    });

    return () => sequence.stop();
  }, [draw, goldDot, purpleDot, wordmark, overlay, onReveal, onFinished]);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]}>
      <LinearGradient colors={tokens.background} style={StyleSheet.absoluteFill} />

      <View style={styles.center}>
        <Svg width={184} height={136} viewBox={MARK_VIEWBOX}>
          <Defs>
            <SvgLinearGradient id="markStroke" x1="0" y1="1" x2="1" y2="0">
              {MARK_STOPS.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </SvgLinearGradient>
          </Defs>

          <AnimatedPath
            d={MARK_PATH}
            stroke="url(#markStroke)"
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={STROKE_LENGTH}
            strokeDashoffset={draw}
          />
        </Svg>

        <Animated.View
          style={[styles.dot, styles.goldDot, { opacity: goldDot, backgroundColor: MARK_STOPS[0].color }]}
        />
        <Animated.View
          style={[styles.dot, styles.purpleDot, { opacity: purpleDot, backgroundColor: MARK_STOPS[2].color }]}
        />

        <Animated.Text
          style={[
            styles.wordmark,
            { color: tokens.textPrimary },
            {
              opacity: wordmark,
              transform: [
                {
                  translateY: wordmark.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Povestea<Text style={{ color: tokens.accentPrimary }}>Noastra</Text>
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  // Positioned to sit on the curve's endpoints inside the 184×136 viewBox.
  goldDot: {
    left: 10,
    top: 106,
  },
  purpleDot: {
    left: 162,
    top: 18,
  },
  wordmark: {
    marginTop: 26,
    fontFamily: fonts.displayBold,
    fontSize: 27,
  },
});
