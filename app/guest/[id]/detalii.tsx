import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { DetaliiHubCard, DetaliiHubCardSkeleton } from '@/components/guest/DetaliiHubCard';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useTheme } from '@/hooks/useTheme';
import { gSpace } from '@/utils/guestTheme';
import { typography } from '@/utils/themeTokens';

type FeatherName = keyof typeof Feather.glyphMap;

interface DetaliiHubCardEntry {
  key: string;
  icon: FeatherName;
  title: string;
  status: string;
  /** Drives the card's at-a-glance StatusDot — same true/false condition
   * that picks between the "unset" and "set" status text below. */
  complete: boolean;
  /** Plan-gated sub-feature — see hooks/usePlanGate.tsx. */
  locked?: boolean;
  route: string;
}

/**
 * All six sub-features load together (one combined content fetch — see
 * useEventContent), so there's no per-card loading state to track; six
 * skeleton cards mirror the real hub layout so nothing shifts on load.
 */
function DetaliiSkeleton() {
  return (
    <GuestScreen transparent>
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <DetaliiHubCardSkeleton key={index} />
        ))}
      </View>
    </GuestScreen>
  );
}

export default function DetaliiScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { content } = useEventContent(id);
  const { isOwner } = useEvents();
  const owner = event !== undefined && isOwner(event);
  const { capabilities } = usePlanGate(id);
  const { tokens } = useTheme();

  if (content === null) return <DetaliiSkeleton />;

  const hasVenue = content.venue.name.trim().length > 0 || content.venue.address.trim().length > 0;
  const seatedCount = content.seatingTables.reduce((sum, table) => sum + table.seat_count, 0);
  // A guest's event.guests is RLS-scoped to their own row, so [0] is theirs.
  const myMenuOptionId = owner ? null : (event?.guests[0]?.menuOptionId ?? null);
  const myMenuOptionName = content.menuOptions.find((option) => option.id === myMenuOptionId)?.name ?? null;

  const cards: DetaliiHubCardEntry[] = [
    {
      key: 'schedule',
      icon: 'clock',
      title: t('detalii.hub.scheduleTitle'),
      status:
        content.schedule.length === 0
          ? t('detalii.hub.scheduleUnset')
          : t('detalii.hub.scheduleCount', { count: content.schedule.length }),
      complete: content.schedule.length > 0,
      route: `/detalii-schedule/${id}`,
    },
    {
      key: 'location',
      icon: 'map-pin',
      title: t('detalii.hub.locationTitle'),
      status: hasVenue
        ? content.venue.address.trim().length > 0
          ? content.venue.address
          : content.venue.name
        : t('detalii.hub.locationUnset'),
      complete: hasVenue,
      route: `/detalii-location/${id}`,
    },
    {
      key: 'menu',
      icon: 'coffee',
      title: t('detalii.hub.menuTitle'),
      status:
        content.menuOptions.length === 0
          ? t('detalii.hub.menuUnset')
          : owner
            ? t('detalii.hub.menuOptionsCount', { count: content.menuOptions.length })
            : myMenuOptionName !== null
              ? t('detalii.hub.menuGuestChosen', { name: myMenuOptionName })
              : t('detalii.hub.menuGuest'),
      complete: content.menuOptions.length > 0,
      route: `/detalii-menu/${id}`,
    },
    {
      key: 'seating',
      icon: 'grid',
      title: t('detalii.hub.seatingTitle'),
      status:
        content.seatingTables.length === 0
          ? t('detalii.hub.seatingUnset')
          : owner
            ? t('detalii.hub.seatingCount', { count: seatedCount })
            : t('detalii.hub.seatingGuest'),
      complete: content.seatingTables.length > 0,
      route: `/detalii-seating/${id}`,
    },
    {
      key: 'accommodation',
      icon: 'home',
      title: t('detalii.hub.accommodationTitle'),
      status: capabilities.lodgingTransportEnabled
        ? content.accommodations.length === 0
          ? t('detalii.hub.accommodationUnset')
          : t('detalii.hub.accommodationCount', { count: content.accommodations.length })
        : t('planGate.hubLockedStatus'),
      complete: content.accommodations.length > 0,
      locked: !capabilities.lodgingTransportEnabled,
      route: capabilities.lodgingTransportEnabled ? `/detalii-accommodation/${id}` : `/pricing/${id}`,
    },
    {
      key: 'vendors',
      icon: 'briefcase',
      title: t('detalii.hub.vendorsTitle'),
      status: capabilities.vendorTaggingEnabled
        ? content.vendors.length === 0
          ? t('detalii.hub.vendorsUnset')
          : t('detalii.hub.vendorsCount', { count: content.vendors.length })
        : t('planGate.hubLockedStatus'),
      complete: content.vendors.length > 0,
      locked: !capabilities.vendorTaggingEnabled,
      route: capabilities.vendorTaggingEnabled ? `/detalii-vendors/${id}` : `/pricing/${id}`,
    },
  ];

  // A guest only sees sections that actually have something in them: no
  // plan-locked cards (an upsell only the organizer can act on) and no empty
  // "not set yet" cards (a to-do list for the organizer, not guest info).
  const visibleCards = owner ? cards : cards.filter((card) => !card.locked && card.complete);

  if (visibleCards.length === 0) {
    return (
      <GuestScreen transparent contentStyle={{ gap: gSpace.md }}>
        <EmptyState icon="info" message={t('detalii.hub.guestEmpty')} />
      </GuestScreen>
    );
  }

  return (
    <GuestScreen transparent>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('detalii.hub.hubTitle')}</Text>
      <View style={styles.grid}>
      {visibleCards.map((card) => (
        <DetaliiHubCard
          key={card.key}
          icon={card.icon}
          title={card.title}
          status={card.status}
          complete={card.complete}
          locked={card.locked}
          showStatusDot={owner}
          onPress={() => router.push(card.route)}
        />
      ))}
      </View>
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title2,
    fontSize: 24,
    lineHeight: 29,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
