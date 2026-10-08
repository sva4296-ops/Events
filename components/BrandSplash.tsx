import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import {
  MARK_DOT_RADIUS,
  MARK_END,
  MARK_PATH,
  MARK_RATIO,
  MARK_START,
  MARK_STOPS,
  MARK_STROKE_LENGTH,
  MARK_STROKE_WIDTH,
  MARK_UNITS_WIDTH,
  MARK_VIEWBOX,
} from '@/utils/brandMark';
import { typography } from '@/utils/themeTokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Must match app.json's splash imageWidth × 0.7 (the mark fills 70% of splash-icon.png). */
const MARK_WIDTH = 180;
const MARK_HEIGHT = MARK_WIDTH / MARK_RATIO;
/**
 * The SVG is drawn at this multiple of its on-screen size and scaled down.
 * react-native-svg rasterizes at layout size, so scaling it up for the
 * heartbeat would stretch that bitmap and look pixelated.
 */
const SUPERSAMPLE = 2;
/** How far the mark glides up to make room for the wordmark. */
const LIFT = 56;
/** Length of the light that runs along the thread, in viewBox units. */
const SPARK_LENGTH = 34;

interface BrandSplashProps {
  /** Fires when the sequence ends, before the fade — the parent routes here. */
  onReveal: () => void;
  /** Fires once the overlay has fully faded out and can be unmounted. */
  onFinished: () => void;
}

/**
 * Warm Story 2.0 animated splash. The native splash (assets/splash-icon.png,
 * see app.json) already shows the full mark, centered, at exactly this size,
 * so the hand-off is seamless. From there:
 *   1. the heart beats twice (lub-dub) while the gold dot pulses,
 *   2. a soft light runs along the thread, from the gold dot through the
 *      heart to the purple dot, which pulses as it arrives,
 *   3. the mark glides up while the wordmark and tagline rise in under it,
 *   4. the overlay fades out.
 * Theme-aware background; the mark's own gradient is brand identity and
 * stays fixed in both modes. About 2.3s end to end.
 */
export function BrandSplash({ onReveal, onFinished }: BrandSplashProps) {
  const { tokens } = useTheme();
  const beat = useRef(new Animated.Value(1)).current;
  const goldPulse = useRef(new Animated.Value(0)).current;
  const purplePulse = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // SVG props (dot radius, dash offset) can't run on the native driver.
    const pulse = (value: Animated.Value) =>
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.spring(value, { toValue: 0, friction: 4, tension: 120, useNativeDriver: false }),
      ]);

    const beatTo = (toValue: number, duration: number) =>
      Animated.timing(beat, { toValue, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true });

    const heartbeat = Animated.sequence([
      beatTo(1.1, 130),
      beatTo(1, 120),
      beatTo(1.06, 110),
      beatTo(1, 160),
    ]);

    const sequence = Animated.sequence([
      Animated.delay(120),
      Animated.parallel([heartbeat, pulse(goldPulse)]),
      Animated.timing(spark, {
        toValue: 1,
        duration: 560,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      pulse(purplePulse),
      Animated.parallel([
        Animated.timing(lift, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmark, {
          toValue: 1,
          duration: 420,
          delay: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tagline, {
          toValue: 1,
          duration: 420,
          delay: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(280),
    ]);

    sequence.start(({ finished }) => {
      if (!finished) return;
      onReveal();
      Animated.timing(overlay, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }).start(() => onFinished());
    });

    return () => sequence.stop();
  }, [beat, goldPulse, purplePulse, spark, lift, wordmark, tagline, overlay, onReveal, onFinished]);

  const rise = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  });
  const dotRadius = (value: Animated.Value) =>
    value.interpolate({ inputRange: [0, 1], outputRange: [MARK_DOT_RADIUS, MARK_DOT_RADIUS * 1.7] });

  // One short dash with a gap longer than the whole path: offset +SPARK_LENGTH
  // hides it before the start, -MARK_STROKE_LENGTH carries it past the end.
  const sparkOffset = spark.interpolate({ inputRange: [0, 1], outputRange: [SPARK_LENGTH, -MARK_STROKE_LENGTH] });
  const sparkOpacity = spark.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 0.75, 0.75, 0] });

  return (
    <Animated.View style={[styles.overlay, { opacity: overlay }]}>
      <LinearGradient colors={tokens.background} style={StyleSheet.absoluteFill} />

      {/* The mark starts dead-center (matching the native splash), beats, then glides up. */}
      <Animated.View
        style={{ transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT] }) }] }}
      >
        <Animated.View style={{ transform: [{ scale: Animated.multiply(beat, 1 / SUPERSAMPLE) }] }}>
          <Svg width={MARK_WIDTH * SUPERSAMPLE} height={MARK_HEIGHT * SUPERSAMPLE} viewBox={MARK_VIEWBOX} style={styles.mark}>
            <Defs>
              <SvgLinearGradient
                id="splashThread"
                x1="0"
                y1="0"
                x2={MARK_UNITS_WIDTH}
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                {MARK_STOPS.map((stop) => (
                  <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Path
              d={MARK_PATH}
              stroke="url(#splashThread)"
              strokeWidth={MARK_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <AnimatedPath
              d={MARK_PATH}
              stroke="#FFFFFF"
              strokeOpacity={sparkOpacity}
              strokeWidth={MARK_STROKE_WIDTH * 0.55}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[SPARK_LENGTH, MARK_STROKE_LENGTH + SPARK_LENGTH]}
              strokeDashoffset={sparkOffset}
              fill="none"
            />
            <AnimatedCircle cx={MARK_START.x} cy={MARK_START.y} r={dotRadius(goldPulse)} fill={MARK_STOPS[0].color} />
            <AnimatedCircle cx={MARK_END.x} cy={MARK_END.y} r={dotRadius(purplePulse)} fill={MARK_STOPS[2].color} />
          </Svg>
        </Animated.View>
      </Animated.View>

      <View style={styles.textBlock} pointerEvents="none">
        <Animated.Text style={[styles.wordmark, { color: tokens.textPrimary }, rise(wordmark)]}>
          PovesteaNoastra
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { color: tokens.textSecondary }, rise(tagline)]}>
          Mai mult decât o invitație. Toată povestea.
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
  mark: {
    overflow: 'visible',
  },
  // Sits just under where the mark ends up after the lift.
  textBlock: {
    position: 'absolute',
    left: 32,
    right: 32,
    top: '50%',
    marginTop: MARK_HEIGHT / 2 - LIFT + 24,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: typography.title1.fontFamily,
    fontSize: 30,
    lineHeight: 36,
  },
  tagline: {
    marginTop: 8,
    fontFamily: typography.quote.fontFamily,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
