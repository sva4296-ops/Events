import { usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { themeRadius } from "@/utils/themeTokens";

/**
 * Spotlight tour ("Arată-mi" in Primii pași): dims the screen except one real
 * button and explains it. The hole is left uncovered, so the user taps the
 * actual button through it; the tour ends on the next navigation, a tap on the
 * dimmed area, or "Am înțeles".
 *
 * Imperative, like the action sheet: startTour() from anywhere, TourHost is
 * mounted once in app/_layout.tsx. Screens mark buttons with useTourTarget(key).
 */

export interface TourStep {
  /** Key a screen registered with useTourTarget. */
  target: string;
  title: string;
  body: string;
  /** Shown instead of `body` when the button isn't on screen (e.g. no guests yet). */
  missingBody?: string;
}

interface Measurable {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Spot extends Rect {
  /** Corner radius of the target, so the wave follows its shape. */
  radius: number;
}

interface TargetEntry {
  node: Measurable;
  radius?: number;
}

const targets = new Map<string, TargetEntry>();
let present: ((step: TourStep | null) => void) | null = null;

export function startTour(step: TourStep): void {
  present?.(step);
}

export function endTour(): void {
  present?.(null);
}

/** Ref for the element the tour can point at. Pass to any View/Touchable `ref`. */
export function useTourTarget(key: string | undefined, radius?: number) {
  const current = useRef<Measurable | null>(null);
  return useCallback(
    (node: Measurable | null) => {
      if (key === undefined) return;
      if (node !== null) {
        current.current = node;
        targets.set(key, { node, radius });
      } else if (
        current.current !== null &&
        targets.get(key)?.node === current.current
      ) {
        targets.delete(key);
        current.current = null;
      }
    },
    [key, radius],
  );
}

/** Default corner radius: half the height, capped at 22 (round buttons and the app's cards). */
const DEFAULT_MAX_RADIUS = 22;

function measure(node: Measurable): Promise<Rect | null> {
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
    );
  });
}

const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < 1 &&
  Math.abs(a.y - b.y) < 1 &&
  Math.abs(a.width - b.width) < 1;

const DIM_COLOR = "rgba(16, 12, 28, 0.62)";
const FIRST_LOOK_MS = 450; // let the screen / tab transition finish
const RETRY_MS = 250;
const MAX_TRIES = 14; // ~4s, then show the tip without a spotlight

export function TourHost() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const [step, setStep] = useState<TourStep | null>(null);
  const [rect, setRect] = useState<Spot | "missing" | null>(null);
  const shownAt = useRef<string | null>(null);
  const latestPath = useRef(pathname);
  latestPath.current = pathname;

  useEffect(() => {
    present = (next) => {
      shownAt.current = null;
      setRect(null);
      setStep(next);
    };
    return () => {
      present = null;
    };
  }, []);

  // Find the target once the destination screen has settled: two equal
  // measurements in a row, so a mid-transition position is never used.
  useEffect(() => {
    if (step === null) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      const entry = targets.get(step.target);
      const first = entry !== undefined ? await measure(entry.node) : null;
      if (first !== null && entry !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const second = await measure(entry.node);
        if (cancelled) return;
        if (second !== null && sameRect(first, second)) {
          shownAt.current = latestPath.current;
          setRect({
            ...second,
            radius: entry.radius ?? Math.min(second.height / 2, DEFAULT_MAX_RADIUS),
          });
          return;
        }
      }
      tries += 1;
      if (tries >= MAX_TRIES) {
        shownAt.current = latestPath.current;
        setRect("missing");
        return;
      }
      timer = setTimeout(() => void tick(), RETRY_MS);
    };

    timer = setTimeout(() => void tick(), FIRST_LOOK_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step]);

  // Tapping the highlighted button usually opens another screen: done.
  useEffect(() => {
    if (
      step !== null &&
      shownAt.current !== null &&
      shownAt.current !== pathname
    ) {
      setStep(null);
      setRect(null);
      shownAt.current = null;
    }
  }, [pathname, step]);

  // A wave leaving the target's edge: grows a little and fades out, then again.
  const wave = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion || rect === null || rect === "missing") return;
    wave.set(0);
    wave.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(wave);
  }, [rect, reducedMotion, wave]);
  const waveStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0 : 0.9 * (1 - wave.get()),
    transform: [{ scale: 1 + wave.get() * 0.1 }],
  }));

  if (step === null || rect === null) return null;

  const close = () => endTour();
  const dim = { backgroundColor: DIM_COLOR };

  const card = (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      <Text style={[styles.title, { color: tokens.textPrimary }]}>
        {step.title}
      </Text>
      <Text style={[styles.body, { color: tokens.textSecondary }]}>
        {rect === "missing"
          ? (step.missingBody ?? t("gettingStarted.missingTarget"))
          : step.body}
      </Text>
      <Button
        label={t("gettingStarted.gotIt")}
        variant="tonal"
        onPress={close}
      />
    </View>
  );

  if (rect === "missing") {
    return (
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        style={StyleSheet.absoluteFill}
      >
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, dim]}
          activeOpacity={1}
          onPress={close}
        />
        <View style={styles.center} pointerEvents="box-none">
          {card}
        </View>
      </Animated.View>
    );
  }

  // The dim is ONE view: a border so thick it covers the whole screen, whose
  // inner edge has the target's radius (inner radius = outer radius - width).
  // Its outer corners fall far off screen, so no seams and no corners show.
  const hole = rect;
  const spread = Math.max(screenW, screenH);
  const below = hole.y + hole.height / 2 < screenH * 0.55;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      <View
        pointerEvents="none"
        style={[
          styles.dimLayer,
          {
            left: rect.x - spread,
            top: rect.y - spread,
            width: rect.width + spread * 2,
            height: rect.height + spread * 2,
            borderWidth: spread,
            borderRadius: rect.radius + spread,
            borderColor: DIM_COLOR,
          },
        ]}
      />

      {/* Four invisible panels around the target catch taps outside it (close);
          the target itself passes touches through to the real button. */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        style={[
          styles.panel,
          { top: 0, left: 0, right: 0, height: Math.max(hole.y, 0) },
        ]}
      />
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        style={[
          styles.panel,
          { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 },
        ]}
      />
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        style={[
          styles.panel,
          {
            top: hole.y,
            height: hole.height,
            left: 0,
            width: Math.max(hole.x, 0),
          },
        ]}
      />
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        style={[
          styles.panel,
          {
            top: hole.y,
            height: hole.height,
            left: hole.x + hole.width,
            right: 0,
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.wave,
          {
            left: hole.x,
            top: hole.y,
            width: hole.width,
            height: hole.height,
            borderRadius: hole.radius,
            borderColor: tokens.onAccent,
          },
          waveStyle,
        ]}
      />

      <View
        style={[
          styles.cardWrap,
          below
            ? { top: hole.y + hole.height + 14 }
            : { bottom: screenH - hole.y + 14 },
          { width: screenW - 32 },
        ]}
        pointerEvents="box-none"
      >
        {card}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
  },
  wave: {
    position: "absolute",
    borderWidth: 2,
  },
  dimLayer: {
    position: "absolute",
  },
  cardWrap: {
    position: "absolute",
    left: 16,
  },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
});
