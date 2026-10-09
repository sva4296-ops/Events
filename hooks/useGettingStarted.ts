import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { startTour } from "@/components/tour/Tour";
import { useEventContent } from "@/hooks/useEventContent";
import { useEvents } from "@/hooks/useEvents";
import i18n from "@/utils/i18n";

export type GettingStartedKey =
  "event" | "location" | "schedule" | "guests" | "invites" | "moment";

export interface GettingStartedStep {
  key: GettingStartedKey;
  done: boolean;
  /** null for the "event created" step, which has nothing to show. */
  showMe: (() => void) | null;
}

/** Tour target keys, shared with the screens that register them. */
export const TOUR_TARGETS = {
  location: "plan-location",
  schedule: "plan-schedule",
  guests: "guests-add",
  invites: "guests-whatsapp",
  moment: "acasa-post-moment",
} as const;

function tour(
  key: Exclude<GettingStartedKey, "event">,
  navigate: () => void,
  withMissing = false,
) {
  return () => {
    navigate();
    startTour({
      target: TOUR_TARGETS[key],
      title: i18n.t(`gettingStarted.steps.${key}.title`),
      body: i18n.t(`gettingStarted.steps.${key}.tip`),
      missingBody: withMissing
        ? i18n.t(`gettingStarted.steps.${key}.missing`)
        : undefined,
    });
  };
}

/**
 * The organizer's "Primii pași" checklist for one event. Every step is read
 * from data the app already has, so it ticks itself as things get done.
 */
export function useGettingStarted(eventId: string) {
  const { getEvent } = useEvents();
  const { content } = useEventContent(eventId);
  const event = getEvent(eventId);

  const guests = event?.guests ?? [];
  const hasVenue =
    content !== null &&
    (content.venue.name.trim().length > 0 ||
      content.venue.address.trim().length > 0);

  const toPlan = () => router.navigate(`/guest/${eventId}/detalii`);
  const toAcasa = () => router.navigate(`/guest/${eventId}`);
  const toGuests = () => router.push(`/event/${eventId}`);

  const steps: GettingStartedStep[] = [
    { key: "event", done: true, showMe: null },
    { key: "location", done: hasVenue, showMe: tour("location", toPlan) },
    {
      key: "schedule",
      done: (content?.schedule.length ?? 0) > 0,
      showMe: tour("schedule", toPlan),
    },
    {
      key: "guests",
      done: guests.length > 0,
      showMe: tour("guests", toGuests),
    },
    {
      key: "invites",
      done: guests.some(
        (guest) => guest.whatsappSentAt !== null || guest.status !== "pending",
      ),
      showMe: tour("invites", toGuests, true),
    },
    {
      key: "moment",
      done: (content?.moments.length ?? 0) > 0,
      showMe: tour("moment", toAcasa),
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;

  return {
    ready: event !== undefined && content !== null,
    steps,
    doneCount,
    total: steps.length,
    allDone: doneCount === steps.length,
  };
}

const hiddenKey = (eventId: string) =>
  `povesteanoastra:getting-started-hidden:v1:${eventId}`;

/** Whether the organizer closed the Acasă card for this event (per device). */
export function useGettingStartedCardHidden(eventId: string) {
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(hiddenKey(eventId))
      .then((value) => {
        if (active) setHidden(value === "1");
      })
      .catch(() => {
        if (active) setHidden(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  const hide = useCallback(() => {
    setHidden(true);
    AsyncStorage.setItem(hiddenKey(eventId), "1").catch(() => undefined);
  }, [eventId]);

  return { hidden, hide };
}
