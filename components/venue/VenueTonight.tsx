import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Skeleton } from '@/components/Skeleton';
import { Eyebrow } from '@/components/spontaneous/parts';
import { VenueHomeCard } from '@/components/venue/VenueHomeCard';
import { useTheme } from '@/hooks/useTheme';
import { useVenue } from '@/hooks/useVenue';
import type { AppEvent } from '@/types/event';
import type { VenueBooking } from '@/types/venue';
import { getEventType } from '@/utils/eventTypes';
import { daysUntilEvent } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { AVATAR_COLORS, AVATAR_INK, formatSpontaneousWhen } from '@/utils/spontaneous';
import { bandGradientLocations, themeRadius, typography } from '@/utils/themeTokens';

const MAX_AVATARS = 6;

/**
 * Acasă ("Tonight") for a venue night: countdown with the booking button,
 * who already booked, the programme, the venue (Follow) and its next nights.
 * The venue itself also gets its bookings card on top.
 */
export function VenueTonight({ event, owner }: { event: AppEvent; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { venue } = useVenue(event.id);
  const type = getEventType('venue');
  const days = daysUntilEvent(event.date);
  const booked = venue?.myBooking?.status === 'confirmed';

  return (
    <GuestScreen transparent>
      <LinearGradient colors={type.band} locations={bandGradientLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        {days !== null && days >= 0 ? (
          <View style={styles.days}>
            <Text style={[styles.daysValue, { color: type.bandInk }]}>{days}</Text>
            <Text style={[styles.daysLabel, { color: type.bandInk }]}>
              {days === 0 ? t('venue.tonight.tonight') : t('spontaneous.home.daysLeft', { count: days })}
            </Text>
          </View>
        ) : null}
        <View style={styles.heroText}>
          <Text style={[styles.heroTitle, { color: type.bandInk }]} numberOfLines={2}>
            {event.name}
          </Text>
          <Text style={[styles.heroMeta, { color: type.bandInk }]}>{formatSpontaneousWhen(event.date, event.startTime)}</Text>
          {!owner ? (
            <TouchableOpacity
              onPress={() => {
                haptics.press();
                router.push(booked ? `/guest/${event.id}/fond` : `/guest/${event.id}/detalii`);
              }}
              accessibilityRole="button"
              style={styles.heroButton}
            >
              <Text style={[styles.heroButtonText, { color: type.bandInk }]}>
                {booked ? t('venue.home.seeTicket') : t('venue.book.cta')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {owner ? <VenueHomeCard event={event} owner /> : null}

      {venue === null ? (
        <Skeleton height={90} radius={24} />
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Eyebrow right={t('venue.book.people', { count: venue.bookedPeople })}>{t('venue.tonight.alreadyBooked')}</Eyebrow>
            {venue.bookerInitials.length === 0 ? (
              <Text style={[styles.muted, { color: tokens.textSecondary }]}>{t('venue.tonight.beFirst')}</Text>
            ) : (
              <View style={styles.avatars}>
                {venue.bookerInitials.slice(0, MAX_AVATARS).map((initials, index) => (
                  <View
                    key={`${initials}-${index}`}
                    style={[
                      styles.avatar,
                      index > 0 && styles.overlap,
                      { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length], borderColor: tokens.surface },
                    ]}
                  >
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                ))}
                {venue.bookedPeople > venue.bookerInitials.length ? (
                  <View style={[styles.avatar, styles.overlap, { backgroundColor: tokens.accentTint, borderColor: tokens.surface }]}>
                    <Text style={[styles.moreText, { color: tokens.accentText }]}>+{venue.bookedPeople - venue.bookerInitials.length}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <VenueLineup venue={venue} />
          <VenuePlaceCard venue={venue} owner={owner} />
          <VenueUpcoming venue={venue} />
        </>
      )}
    </GuestScreen>
  );
}

/** "Tonight's programme": one row per schedule item. */
export function VenueLineup({ venue }: { venue: VenueBooking }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  if (venue.lineup.length === 0) return null;
  return (
    <>
      <Eyebrow>{t('venue.book.lineup')}</Eyebrow>
      {venue.lineup.map((item) => (
        <View key={`${item.time}-${item.title}`} style={[styles.lineRow, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.lineTime, { color: tokens.accentText }]}>{item.time}</Text>
          <Text style={[styles.lineTitle, { color: tokens.textPrimary }]}>{item.title}</Text>
        </View>
      ))}
    </>
  );
}

/** The venue: name, area, Follow / Following. */
export function VenuePlaceCard({ venue, owner }: { venue: VenueBooking; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { setFollow } = useVenue(venue.eventId);
  const name = venue.hostName ?? venue.location;
  if (name.trim().length === 0) return null;
  return (
    <View style={[styles.place, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <View style={[styles.placeIcon, { backgroundColor: tokens.accentTint }]}>
        <EventTypeIcon type="venue" size={22} color={tokens.accentText} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.placeName, { color: tokens.textPrimary }]}>{name}</Text>
        {venue.hostName !== null && venue.location.trim().length > 0 ? (
          <Text style={[styles.placeArea, { color: tokens.textSecondary }]} numberOfLines={1}>
            {venue.location}
          </Text>
        ) : null}
      </View>
      {!owner && venue.agencyId !== null ? (
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            if (venue.agencyId !== null) setFollow({ agencyId: venue.agencyId, follow: !venue.following });
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: venue.following }}
          style={[
            styles.follow,
            venue.following
              ? { backgroundColor: tokens.accentFill, borderColor: tokens.accentFill }
              : { borderColor: tokens.accentPrimary },
          ]}
        >
          <Text style={[styles.followText, { color: venue.following ? tokens.onAccent : tokens.accentText }]}>
            {venue.following ? t('venue.tonight.following') : t('venue.tonight.follow')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** "Coming up at <venue>": its next nights, each opening its own booking page. */
function VenueUpcoming({ venue }: { venue: VenueBooking }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  if (venue.upcoming.length === 0) return null;
  return (
    <>
      <Eyebrow>{t('venue.tonight.comingUp', { venue: venue.hostName ?? t('venue.book.thisVenue') })}</Eyebrow>
      {venue.upcoming.map((night) => (
        <View key={night.eventId} style={[styles.place, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={[styles.placeIcon, { backgroundColor: tokens.accentTint }]}>
            <EventTypeIcon type="venue" size={20} color={tokens.accentText} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.placeName, { color: tokens.textPrimary }]} numberOfLines={1}>
              {night.name}
            </Text>
            <Text style={[styles.placeArea, { color: tokens.textSecondary }]}>{formatSpontaneousWhen(night.date, night.startTime)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/book/${night.eventId}?t=${night.publicToken}`)}
            accessibilityRole="button"
            style={[styles.follow, { borderColor: tokens.accentPrimary }]}
          >
            <Text style={[styles.followText, { color: tokens.accentText }]}>{t('venue.tonight.bookShort')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  days: {
    alignItems: 'center',
    minWidth: 64,
  },
  daysValue: {
    ...typography.display,
    fontSize: 46,
    lineHeight: 52,
  },
  daysLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroMeta: {
    fontSize: 13,
    opacity: 0.9,
  },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  muted: {
    fontSize: 14,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlap: {
    marginLeft: -8,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: AVATAR_INK,
  },
  moreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  lineTime: {
    width: 56,
    fontSize: 15,
    fontWeight: '700',
  },
  lineTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  placeName: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  placeArea: {
    fontSize: 13,
  },
  follow: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  followText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
