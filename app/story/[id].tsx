import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Button, buttonLabelColor } from "@/components/Button";
import { fetchStoryConfirmedGuests } from "@/data/storyRepository";
import { useEventContent } from "@/hooks/useEventContent";
import { useEvents } from "@/hooks/useEvents";
import { useTheme } from "@/hooks/useTheme";
import type { AppEvent } from "@/types/event";
import { EVENT_COVERS, EVENT_TYPE_COLORS } from "@/utils/eventCovers";
import {
  buildEventStory,
  type JourneyItem,
  type StorySlide,
} from "@/utils/eventStory";
import { formatEventDate } from "@/utils/format";
import { haptics } from "@/utils/haptics";
import { typeface, typography } from "@/utils/themeTokens";

const SLIDE_MS = 6000;
const INK = "#FFFFFF";
const INK_MUTED = "rgba(255,255,255,0.78)";
const INK_FAINT = "rgba(255,255,255,0.32)";
const PANEL = "rgba(255,255,255,0.12)";
const VEIL = [
  "rgba(15,12,28,0.45)",
  "rgba(15,12,28,0.7)",
  "rgba(15,12,28,0.92)",
] as const;

/**
 * The post-event story: full-screen slides (cover, numbers, the run-up,
 * the day's schedule, photos, who took them, thanks, album) built from the
 * event's own data with per-type templates. Tap right / left to move, hold to
 * pause; each slide advances on its own after 6s. Always dark, over the
 * event type's cover art, like a photo story.
 */
export default function EventStoryScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id ?? "";
  const insets = useSafeAreaInsets();
  const { getEvent } = useEvents();
  const event = getEvent(eventId);
  const { content } = useEventContent(eventId);
  const guestsQuery = useQuery({
    queryKey: ["storyGuests", eventId],
    queryFn: () => fetchStoryConfirmedGuests(eventId),
    enabled: eventId.length > 0,
    staleTime: 5 * 60_000,
  });

  const slides = useMemo(
    () =>
      event !== undefined && content !== null && guestsQuery.data !== undefined
        ? buildEventStory(event, content, guestsQuery.data)
        : null,
    [event, content, guestsQuery.data],
  );

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{ presentation: "fullScreenModal", animation: "fade" }}
      />
      {event !== undefined ? (
        <ImageBackground
          source={EVENT_COVERS[event.type]}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <LinearGradient colors={VEIL} style={StyleSheet.absoluteFill} />
        </ImageBackground>
      ) : null}

      {slides === null || event === undefined ? (
        <View style={styles.loading}>
          <ActivityIndicator color={INK} />
        </View>
      ) : (
        <StoryPlayer
          event={event}
          slides={slides}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      )}

      <TouchableOpacity
        style={[styles.close, { top: insets.top + 26 }]}
        onPress={() => router.back()}
        hitSlop={12}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t("story.close")}
      >
        <Feather name="x" size={24} color={INK} />
      </TouchableOpacity>
    </View>
  );
}

function StoryPlayer({
  event,
  slides,
  topInset,
  bottomInset,
}: {
  event: AppEvent;
  slides: StorySlide[];
  topInset: number;
  bottomInset: number;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  // Bumped to replay the current slide (tapping back on the first one).
  const [cycle, setCycle] = useState(0);
  const progress = useSharedValue(0);
  const heldRef = useRef(false);
  const last = slides.length - 1;
  const slide = slides[index] ?? slides[0]!;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0) {
        setCycle((value) => value + 1);
        return;
      }
      if (next > last) return;
      setIndex(next);
    },
    [last],
  );

  const run = useCallback(
    (from: number) => {
      progress.set(from);
      progress.set(
        withTiming(
          1,
          { duration: SLIDE_MS * (1 - from), easing: Easing.linear },
          (finished) => {
            if (finished) scheduleOnRN(goTo, index + 1);
          },
        ),
      );
    },
    [goTo, index, progress],
  );

  // Each slide starts its own timer; the last one stays until closed.
  useEffect(() => {
    if (index === last) {
      progress.set(1);
      return;
    }
    run(0);
    return () => cancelAnimation(progress);
  }, [index, cycle, last, progress, run]);

  const pause = () => {
    heldRef.current = false;
    cancelAnimation(progress);
  };
  const resume = () => {
    if (index !== last) run(progress.get());
  };

  return (
    <View style={styles.fill}>
      <View style={[styles.bars, { top: topInset + 10 }]}>
        {slides.map((item, i) => (
          <ProgressSegment
            key={`${item.kind}-${i}`}
            state={i < index ? "done" : i === index ? "active" : "todo"}
            progress={progress}
          />
        ))}
      </View>

      <Animated.View
        key={index}
        entering={FadeIn.duration(260)}
        style={[
          styles.slide,
          { paddingTop: topInset + 72, paddingBottom: bottomInset + 32 },
        ]}
      >
        <SlideView event={event} slide={slide} />
      </Animated.View>

      {/* Tap zones: left third goes back, the rest forward; holding pauses.
          The end slide has buttons of its own, so only the left zone stays. */}
      <View
        style={[styles.zones, { top: topInset + 64 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.zoneBack}
          activeOpacity={1}
          delayLongPress={220}
          onLongPress={() => {
            heldRef.current = true;
          }}
          onPressIn={pause}
          onPressOut={resume}
          onPress={() => {
            if (heldRef.current) return;
            haptics.tap();
            goTo(index - 1);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("story.previous")}
        />
        {index !== last ? (
          <TouchableOpacity
            style={styles.zoneNext}
            activeOpacity={1}
            delayLongPress={220}
            onLongPress={() => {
              heldRef.current = true;
            }}
            onPressIn={pause}
            onPressOut={resume}
            onPress={() => {
              if (heldRef.current) return;
              haptics.tap();
              goTo(index + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={t("story.next")}
          />
        ) : (
          <View style={styles.zoneNext} pointerEvents="none" />
        )}
      </View>
    </View>
  );
}

function ProgressSegment({
  state,
  progress,
}: {
  state: "done" | "active" | "todo";
  progress: SharedValue<number>;
}) {
  const fillStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: state === "done" ? 1 : state === "todo" ? 0 : progress.get() },
    ],
  }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.trackFill, fillStyle]} />
    </View>
  );
}

function SlideView({ event, slide }: { event: AppEvent; slide: StorySlide }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const accent = EVENT_TYPE_COLORS[event.type].fill;

  switch (slide.kind) {
    case "cover":
      return (
        <View style={[styles.slideBody, styles.bottom]}>
          <View style={[styles.chip, { backgroundColor: accent }]}>
            <Text
              style={[
                styles.chipText,
                { color: EVENT_TYPE_COLORS[event.type].onFill },
              ]}
            >
              {t(`eventTypes.${event.type}.label`)}
            </Text>
          </View>
          <Text style={styles.kicker}>
            {t(`story.types.${event.type}.cover`)}
          </Text>
          <Text style={styles.hero}>{event.name}</Text>
          <Text style={styles.meta}>
            {formatEventDate(event.date)}
            {event.location.trim().length > 0
              ? ` · ${event.location.trim()}`
              : ""}
          </Text>
        </View>
      );

    case "stats": {
      const rows = [
        {
          value: slide.guests,
          label: t("story.statsGuests", { count: slide.guests }),
        },
        {
          value: slide.photos,
          label: t("story.statsPhotos", { count: slide.photos }),
        },
        {
          value: slide.moments,
          label: t("story.statsMoments", { count: slide.moments }),
        },
      ].filter((row) => row.value > 0);
      return (
        <View style={[styles.slideBody, styles.center]}>
          <Text style={styles.title}>{t("story.statsTitle")}</Text>
          <View style={styles.statList}>
            {rows.map((row) => (
              <View key={row.label} style={styles.statRow}>
                <AnimatedNumber
                  value={row.value}
                  style={[styles.statNumber, { color: accent }]}
                  duration={900}
                />
                <Text style={styles.statLabel}>{row.label}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    case "journey":
      return (
        <View style={styles.slideBody}>
          <Text style={styles.title}>{t("story.journeyTitle")}</Text>
          <View style={styles.list}>
            {slide.items.map((item) => (
              <View key={item.id} style={styles.journeyRow}>
                {item.photoUrl !== null ? (
                  <Image
                    source={{ uri: item.photoUrl }}
                    style={styles.journeyPhoto}
                  />
                ) : (
                  <View style={[styles.journeyPhoto, styles.journeyDot]}>
                    <Feather name="star" size={20} color={INK} />
                  </View>
                )}
                <View style={styles.journeyText}>
                  <Text style={[styles.when, { color: accent }]}>
                    {journeyWhen(t, item)}
                  </Text>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      );

    case "day":
      return (
        <View style={styles.slideBody}>
          <Text style={styles.title}>{t(`story.types.${event.type}.day`)}</Text>
          <View style={styles.list}>
            {slide.schedule.map((item) => (
              <View key={item.id} style={styles.scheduleRow}>
                <Text style={[styles.time, { color: accent }]}>
                  {item.time}
                </Text>
                <View style={styles.scheduleText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.location.trim().length > 0 ? (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.location}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      );

    case "photos":
      return (
        <View style={styles.slideBody}>
          <Text style={styles.title}>{t("story.photosTitle")}</Text>
          <Text style={styles.meta}>
            {t("story.photosCount", { count: slide.total })}
          </Text>
          <View style={styles.grid}>
            {slide.urls.map((url, i) => (
              <Image
                key={`${url}-${i}`}
                source={{ uri: url }}
                style={styles.gridPhoto}
              />
            ))}
          </View>
        </View>
      );

    case "people":
      return (
        <View style={[styles.slideBody, styles.center]}>
          <Text style={styles.title}>{t("story.peopleTitle")}</Text>
          <Text style={styles.meta}>
            {t("story.peopleCount", { count: slide.uploaders })}
          </Text>
          <View style={styles.list}>
            {slide.names.map((name) => (
              <View key={name} style={styles.personRow}>
                <View style={[styles.personIcon, { backgroundColor: PANEL }]}>
                  <Feather name="camera" size={16} color={INK} />
                </View>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );

    case "thanks":
      return (
        <View style={[styles.slideBody, styles.center]}>
          <Feather name="heart" size={32} color={accent} />
          <Text style={styles.quote}>
            {t(`story.types.${event.type}.thanks`)}
          </Text>
        </View>
      );

    case "end":
      return (
        <View style={[styles.slideBody, styles.bottom]}>
          <Text style={styles.title}>{t("story.endTitle")}</Text>
          <Text style={styles.meta}>{t("story.endBody")}</Text>
          <View style={styles.endActions}>
            <Button
              label={t("story.openAlbum")}
              icon={
                <Feather
                  name="image"
                  size={20}
                  color={buttonLabelColor("primary", tokens)}
                />
              }
              onPress={() => router.replace(`/guest/${event.id}/album`)}
            />
          </View>
        </View>
      );
  }
}

function journeyWhen(
  t: (key: string, options?: Record<string, unknown>) => string,
  item: JourneyItem,
): string {
  const days = item.daysBefore;
  if (days === 0) return t("story.whenDay");
  if (days < 14) return t("story.whenDays", { count: days });
  if (days < 60) return t("story.whenWeeks", { count: Math.round(days / 7) });
  return t("story.whenMonths", { count: Math.round(days / 30) });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F0C1C",
  },
  fill: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  close: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bars: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
    zIndex: 2,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: INK_FAINT,
    overflow: "hidden",
  },
  trackFill: {
    flex: 1,
    backgroundColor: INK,
    transformOrigin: "left",
  },
  slide: {
    flex: 1,
    paddingHorizontal: 24,
  },
  slideBody: {
    flex: 1,
    gap: 14,
  },
  center: {
    justifyContent: "center",
  },
  bottom: {
    justifyContent: "flex-end",
  },
  zones: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 140,
    flexDirection: "row",
  },
  zoneBack: {
    width: "30%",
  },
  zoneNext: {
    flex: 1,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
  },
  chipText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 13,
  },
  kicker: {
    ...typography.quote,
    color: INK_MUTED,
  },
  hero: {
    fontFamily: typeface.display,
    fontSize: 42,
    lineHeight: 48,
    color: INK,
  },
  title: {
    ...typography.display,
    color: INK,
  },
  meta: {
    ...typography.body,
    color: INK_MUTED,
  },
  statList: {
    gap: 22,
    marginTop: 8,
  },
  statRow: {
    gap: 2,
  },
  statNumber: {
    fontFamily: typeface.display,
    fontSize: 56,
    lineHeight: 62,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    ...typography.subtitle,
    color: INK,
  },
  list: {
    gap: 14,
    marginTop: 8,
  },
  journeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  journeyPhoto: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: PANEL,
  },
  journeyDot: {
    alignItems: "center",
    justifyContent: "center",
  },
  journeyText: {
    flex: 1,
    gap: 2,
  },
  when: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 13,
  },
  rowTitle: {
    ...typography.subtitle,
    color: INK,
  },
  rowMeta: {
    ...typography.bodySmall,
    color: INK_MUTED,
  },
  scheduleRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  time: {
    width: 56,
    fontFamily: typeface.bodyBold,
    fontSize: 17,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  scheduleText: {
    flex: 1,
    gap: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  gridPhoto: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: PANEL,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  personIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  quote: {
    fontFamily: typeface.title,
    fontSize: 28,
    lineHeight: 36,
    color: INK,
  },
  endActions: {
    marginTop: 12,
    gap: 12,
  },
});
