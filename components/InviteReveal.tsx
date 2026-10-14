import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { InviteEnvelope } from '@/components/InviteEnvelope';
import type { EventTypeId } from '@/types/event';
import { EVENT_TYPE_COLORS } from '@/utils/eventCovers';
import { haptics } from '@/utils/haptics';

/** Must match InviteCard's radius, so the corporate shine is clipped to the card. */
const CARD_RADIUS = 28;
const PARTICLES = 16;

/** Deterministic 0..1 noise per (index, channel): same layout every time, pure render. */
const noise = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

type Particle = {
  /** Start position, as a fraction of the container. */
  x: number;
  y: number;
  /** Travel in px. */
  dx: number;
  dy: number;
  gravity: number;
  spin: number;
  size: number;
  round: boolean;
  outline: boolean;
  color: string;
  /** 0..1, when it starts inside the shared progress. */
  delay: number;
};

function confetti(colors: readonly string[]): Particle[] {
  return Array.from({ length: PARTICLES }, (_, i) => ({
    x: 0.5,
    y: 0.22,
    dx: (noise(i, 1) - 0.5) * 340,
    dy: -120 - noise(i, 2) * 120,
    gravity: 420,
    spin: (noise(i, 3) - 0.5) * 720,
    size: 6 + noise(i, 4) * 5,
    round: i % 3 === 0,
    outline: false,
    color: colors[i % colors.length] ?? '#FFFFFF',
    delay: noise(i, 5) * 0.12,
  }));
}

function bubbles(color: string): Particle[] {
  return Array.from({ length: 10 }, (_, i) => ({
    x: 0.1 + noise(i, 1) * 0.8,
    y: 0.95,
    dx: (noise(i, 2) - 0.5) * 30,
    dy: -180 - noise(i, 3) * 160,
    gravity: 0,
    spin: 0,
    size: 8 + noise(i, 4) * 12,
    round: true,
    outline: true,
    color,
    delay: noise(i, 5) * 0.45,
  }));
}

function ParticleDot({ progress, p, width, height }: { progress: SharedValue<number>; p: Particle; width: number; height: number }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.get() - p.delay) / (1 - p.delay)));
    return {
      opacity: interpolate(t, [0, 0.08, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: p.dx * t },
        { translateY: p.dy * t + p.gravity * t * t },
        { rotate: `${p.spin * t}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: p.x * width - p.size / 2,
          top: p.y * height - p.size / 2,
          width: p.size,
          height: p.round ? p.size : p.size * 0.5,
          borderRadius: p.round ? p.size / 2 : 1,
        },
        p.outline ? { borderWidth: 1.5, borderColor: p.color } : { backgroundColor: p.color },
        style,
      ]}
    />
  );
}

/**
 * Plays a short, type-specific entrance for the invitation preview, once:
 * wedding opens an envelope, birthday pops with confetti, baptism rises with
 * bubbles, cause beats like a heart, corporate slides in with a shine,
 * memorial fades in slowly and quietly. Transform/opacity only; with
 * "reduce motion" the card just shows.
 */
export function InviteReveal({ type, children }: { type: EventTypeId | null; children: ReactNode }) {
  if (type === 'wedding') return <InviteEnvelope type={type}>{children}</InviteEnvelope>;
  return <SimpleReveal type={type ?? 'other'}>{children}</SimpleReveal>;
}

function SimpleReveal({ type, children }: { type: EventTypeId; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const extra = useSharedValue(0);
  const colors = EVENT_TYPE_COLORS[type];
  const measured = size.width > 0;

  const particles =
    type === 'birthday' ? confetti([colors.fill, ...colors.gradient]) : type === 'baptism' ? bubbles(colors.fill) : [];

  useEffect(() => {
    if (!measured || reduceMotion) return;
    const quiet = type === 'memorial';
    if (type === 'birthday') {
      enter.set(withSpring(1, { damping: 11, stiffness: 140 }));
    } else {
      enter.set(withTiming(1, { duration: quiet ? 1400 : 700, easing: Easing.out(Easing.cubic) }));
    }
    if (type === 'cause') {
      extra.set(
        withDelay(
          650,
          withSequence(
            withTiming(1, { duration: 160 }),
            withTiming(0, { duration: 160 }),
            withTiming(1, { duration: 160 }),
            withTiming(0, { duration: 260 }),
          ),
        ),
      );
    } else if (type === 'birthday' || type === 'baptism') {
      extra.set(withDelay(type === 'birthday' ? 120 : 200, withTiming(1, { duration: type === 'birthday' ? 1300 : 2200, easing: Easing.out(Easing.quad) })));
    } else if (type === 'corporate') {
      extra.set(withDelay(500, withTiming(1, { duration: 750, easing: Easing.inOut(Easing.cubic) })));
    }
    if (!quiet) {
      const tick = setTimeout(() => haptics.tap(), type === 'cause' ? 650 : 120);
      return () => clearTimeout(tick);
    }
    // Plays once per mount, as soon as the size is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

  const cardStyle = useAnimatedStyle(() => {
    const e = enter.get();
    switch (type) {
      case 'birthday':
        return { opacity: Math.min(1, e * 2), transform: [{ scale: interpolate(e, [0, 1], [0.86, 1]) }] };
      case 'cause':
        return {
          opacity: e,
          transform: [{ translateY: interpolate(e, [0, 1], [20, 0]) }, { scale: 1 + extra.get() * 0.025 }],
        };
      case 'corporate':
        return { opacity: e, transform: [{ translateX: interpolate(e, [0, 1], [-28, 0]) }] };
      case 'memorial':
        return { opacity: e, transform: [{ translateY: interpolate(e, [0, 1], [8, 0]) }] };
      default:
        return { opacity: e, transform: [{ translateY: interpolate(e, [0, 1], [28, 0]) }] };
    }
  });

  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(extra.get(), [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(extra.get(), [0, 1], [-140, size.width + 40]) }, { rotate: '18deg' }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    if (measured) return;
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View onLayout={onLayout}>
      <Animated.View style={[!measured && !reduceMotion && styles.hidden, cardStyle]}>
        {children}
        {type === 'corporate' && measured && !reduceMotion ? (
          <View style={styles.shineClip} pointerEvents="none">
            <Animated.View style={[styles.shine, { height: size.height * 1.6 }, shineStyle]} />
          </View>
        ) : null}
      </Animated.View>

      {measured && !reduceMotion && particles.length > 0 ? (
        <View style={styles.particles} pointerEvents="none">
          {particles.map((p, i) => (
            <ParticleDot key={i} progress={extra} p={p} width={size.width} height={size.height} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    opacity: 0,
  },
  particles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
  },
  shineClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: '-30%',
    left: 0,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
