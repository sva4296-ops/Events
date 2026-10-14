import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import type { EventTypeId } from '@/types/event';
import { EVENT_TYPE_COLORS } from '@/utils/eventCovers';
import { haptics } from '@/utils/haptics';

/** Envelope paper, the same warm tones in both themes (it's an object, not UI chrome). */
const PAPER_BACK = '#E6D8C5';
const PAPER_FLAP = '#EFE3D2';
const PAPER_FRONT = '#F7EFE4';
const PAPER_LINE = 'rgba(43,39,64,0.10)';

const ENV_H = 170;
/** How far the card's top sits below the envelope's top while still inside. */
const PEEK = 26;
/** Space under the card, so its shadow isn't clipped by the container. */
const BOTTOM_PAD = 18;
const SEAL = 52;

const FLAP_DELAY = 350;
const FLAP_MS = 520;
const RISE_DELAY = FLAP_DELAY + FLAP_MS + 60;
const RISE_MS = 760;
const DROP_DELAY = RISE_DELAY + RISE_MS - 280;
const DROP_MS = 460;

/**
 * Plays the invitation coming out of an envelope once, on mount: the sealed
 * flap opens, the card rises out, the envelope drops away and only the card
 * stays. Transform/opacity only; with "reduce motion" the card just shows.
 */
export function InviteEnvelope({ type, children }: { type: EventTypeId | null; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [flapBehind, setFlapBehind] = useState(false);
  const [done, setDone] = useState(reduceMotion);

  const flap = useSharedValue(0);
  const rise = useSharedValue(0);
  const drop = useSharedValue(0);

  const measured = width > 0 && cardHeight > 0;
  const colors = EVENT_TYPE_COLORS[type ?? 'other'];

  useEffect(() => {
    if (!measured || done) return;
    flap.set(
      withDelay(FLAP_DELAY, withTiming(1, { duration: FLAP_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        // Once open, the flap goes behind the card so the card rises in front of it.
        if (finished) scheduleOnRN(setFlapBehind, true);
      })),
    );
    rise.set(withDelay(RISE_DELAY, withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.cubic) })));
    drop.set(
      withDelay(DROP_DELAY, withTiming(1, { duration: DROP_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(setDone, true);
      })),
    );
    const tick = setTimeout(() => haptics.tap(), RISE_DELAY);
    return () => clearTimeout(tick);
    // Plays once per mount, as soon as both sizes are known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

  // Card starts inside the envelope (top just below its rim), ends in place.
  const startY = cardHeight + BOTTOM_PAD - ENV_H + PEEK;
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(rise.get(), [0, 1], [startY, 0]) }],
  }));
  const flapStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateX: `${interpolate(flap.get(), [0, 1], [0, 180])}deg` }],
  }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flap.get(), [0, 0.35], [1, 0], 'clamp'),
    transform: [{ scale: interpolate(flap.get(), [0, 0.35], [1, 0.6], 'clamp') }],
  }));
  const envelopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drop.get(), [0, 1], [1, 0]),
    transform: [{ translateY: interpolate(drop.get(), [0, 1], [0, ENV_H * 0.7]) }],
  }));

  const onContainerLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const onCardLayout = (event: LayoutChangeEvent) => {
    if (cardHeight === 0) setCardHeight(event.nativeEvent.layout.height);
  };

  // Envelope parts unmount when done; the card's View stays mounted so it never reloads.
  const showEnvelope = measured && !done;

  const flapLayer = (
    <Animated.View style={[styles.flap, { width, height: ENV_H * 0.58, bottom: ENV_H - ENV_H * 0.58 }, flapStyle]} pointerEvents="none">
      <Svg width={width} height={ENV_H * 0.58}>
        <Path d={`M0 0 H${width} L${width / 2} ${ENV_H * 0.58} Z`} fill={PAPER_FLAP} stroke={PAPER_LINE} strokeWidth={1} />
      </Svg>
    </Animated.View>
  );

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {showEnvelope ? (
        <Animated.View style={[styles.envelope, { height: ENV_H }, envelopeStyle]} pointerEvents="none">
          <Svg width={width} height={ENV_H}>
            <Rect x={0} y={0} width={width} height={ENV_H} rx={18} fill={PAPER_BACK} />
          </Svg>
        </Animated.View>
      ) : null}

      {showEnvelope && flapBehind ? <Animated.View style={[styles.envelopeOverlay, envelopeStyle]}>{flapLayer}</Animated.View> : null}

      {/* Hidden until measured, so it never flashes in place before the animation. */}
      <Animated.View style={[!measured && !done && styles.hidden, showEnvelope && cardStyle]} onLayout={onCardLayout}>
        {children}
      </Animated.View>

      {showEnvelope ? (
        <Animated.View style={[styles.envelopeOverlay, envelopeStyle]} pointerEvents="none">
          <View style={[styles.front, { height: ENV_H }]}>
            <Svg width={width} height={ENV_H}>
              <Path
                d={`M0 ${ENV_H * 0.28} L${width / 2} ${ENV_H * 0.66} L${width} ${ENV_H * 0.28} V${ENV_H - 18} Q${width} ${ENV_H} ${width - 18} ${ENV_H} H18 Q0 ${ENV_H} 0 ${ENV_H - 18} Z`}
                fill={PAPER_FRONT}
                stroke={PAPER_LINE}
                strokeWidth={1}
              />
            </Svg>
          </View>
          {!flapBehind ? flapLayer : null}
          <Animated.View
            style={[
              styles.seal,
              { left: width / 2 - SEAL / 2, bottom: ENV_H - ENV_H * 0.58 - SEAL / 2, backgroundColor: colors.fill },
              sealStyle,
            ]}
          >
            <EventTypeIcon type={type ?? 'other'} size={24} color={colors.onFill} strokeWidth={1.8} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    paddingBottom: BOTTOM_PAD,
  },
  hidden: {
    opacity: 0,
  },
  envelope: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  envelopeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ENV_H,
  },
  front: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  flap: {
    position: 'absolute',
    left: 0,
    // Hinged on the envelope's top edge: rotates open upward around it.
    transformOrigin: 'top',
  },
  seal: {
    position: 'absolute',
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
  },
});
