import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DetaliiHubCard, DetaliiHubCardSkeleton } from '@/components/guest/DetaliiHubCard';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { useEventContent } from '@/hooks/useEventContent';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { gSpace } from '@/utils/guestTheme';

type FeatherName = keyof typeof Feather.glyphMap;

interface DetaliiHubCardEntry {
  key: string;
  icon: FeatherName;
  title: string;
  status: string;
  /** Drives the card's at-a-glance StatusDot — same true/false condition
   * that picks between the "unset" and "set" status text below. */
  complete: boolean;
  route: string;
}

/**
 * All six sub-features load together (one combined content fetch — see
 * useEventContent), so there's no per-card loading state to track; six
 * skeleton cards mirror the real hub layout so nothing shifts on load.
 */
function DetaliiSkeleton() {
  return (
    <GuestScreen transparent contentStyle={{ gap: gSpace.md }}>
      {Array.from({ length: 6 }, (_, index) => (
        <DetaliiHubCardSkeleton key={index} />
      ))}
    </GuestScreen>
  );
}

export default function DetaliiScreen() {
  const { t } = useTranslation();
  const { id } = useGuestEvent();
  const { content } = useEventContent(id);

  if (content === null) return <DetaliiSkeleton />;

  const hasVenue = content.venue.name.trim().length > 0 || content.venue.address.trim().length > 0;
  const seatedCount = content.seatingTables.reduce((sum, table) => sum + table.seat_count, 0);

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
      status: content.menu === null ? t('detalii.hub.menuUnset') : t('detalii.hub.menuSet'),
      complete: content.menu !== null,
      route: `/detalii-menu/${id}`,
    },
    {
      key: 'seating',
      icon: 'users',
      title: t('detalii.hub.seatingTitle'),
      status:
        content.seatingTables.length === 0
          ? t('detalii.hub.seatingUnset')
          : t('detalii.hub.seatingCount', { count: seatedCount }),
      complete: content.seatingTables.length > 0,
      route: `/detalii-seating/${id}`,
    },
    {
      key: 'accommodation',
      icon: 'home',
      title: t('detalii.hub.accommodationTitle'),
      status:
        content.accommodations.length === 0
          ? t('detalii.hub.accommodationUnset')
          : t('detalii.hub.accommodationCount', { count: content.accommodations.length }),
      complete: content.accommodations.length > 0,
      route: `/detalii-accommodation/${id}`,
    },
    {
      key: 'vendors',
      icon: 'briefcase',
      title: t('detalii.hub.vendorsTitle'),
      status:
        content.vendors.length === 0
          ? t('detalii.hub.vendorsUnset')
          : t('detalii.hub.vendorsCount', { count: content.vendors.length }),
      complete: content.vendors.length > 0,
      route: `/detalii-vendors/${id}`,
    },
  ];

  return (
    <GuestScreen transparent contentStyle={{ gap: gSpace.md }}>
      {cards.map((card) => (
        <DetaliiHubCard
          key={card.key}
          icon={card.icon}
          title={card.title}
          status={card.status}
          complete={card.complete}
          onPress={() => router.push(card.route)}
        />
      ))}
    </GuestScreen>
  );
}
