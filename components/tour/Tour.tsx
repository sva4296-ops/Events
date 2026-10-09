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

const targets = new Map<string, Measurable>();
let present: ((step: TourStep | null) => void) | null = null;

export function startTour(step: TourStep): void {
  present?.(step);
}

export function endTour(): void {
  present?.(null);
}

/** Ref for the element the tour can point at. Pass to any View/Touchable `ref`. */
export function useTourTarget(key: string | undefined) {
  const current = useRef<Measurable | null>(null);
  return useCallback(
    (node: Measurable | null) => {
      if (key === undefined) return;
      if (node !== null) {
        current.current = node;
        targets.set(key, node);
      } else if (
        current.current !== null &&
        targets.get(key) === current.current
      ) {
        targets.delete(key);
        current.current = null;
      }
    },
    [key],
  );
}

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

const HOLE_PAD = 6;
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
  const [rect, setRect] = useState<Rect | "missing" | null>(null);
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
      const node = targets.get(step.target);
      const first = node !== undefined ? await measure(node) : null;
      if (first !== null && node !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const second = await measure(node);
        if (cancelled) return;
        if (second !== null && sameRect(first, second)) {
          shownAt.current = latestPath.current;
          setRect(second);
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

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion || rect === null || rect === "missing") return;
    pulse.set(0);
    pulse.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(pulse);
  }, [rect, reducedMotion, pulse]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.get() * 0.45,
    transform: [{ scale: 1 + pulse.get() * 0.04 }],
  }));

  if (step === null || rect === null) return null;

  const close = () => endTour();
  const dim = { backgroundColor: "rgba(16, 12, 28, 0.62)" };

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

  const hole = {
    x: rect.x - HOLE_PAD,
    y: rect.y - HOLE_PAD,
    width: rect.width + HOLE_PAD * 2,
    height: rect.height + HOLE_PAD * 2,
  };
  const below = hole.y + hole.height / 2 < screenH * 0.55;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* Four dim panels around the hole; the hole itself passes touches through. */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        style={[
          styles.panel,
          dim,
          { top: 0, left: 0, right: 0, height: Math.max(hole.y, 0) },
        ]}
      />
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        style={[
          styles.panel,
          dim,
          { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 },
        ]}
      />
      <TouchableOpacity
        activeOpacity={1}
        onPress={close}
        style={[
          styles.panel,
          dim,
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
          dim,
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
          styles.ring,
          {
            left: hole.x,
            top: hole.y,
            width: hole.width,
            height: hole.height,
            borderColor: tokens.onAccent,
          },
          ringStyle,
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
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: themeRadius.lg,
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
