import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { useTheme } from '@/hooks/useTheme';
import type { VenueZoneDraft } from '@/types/event';
import { parseTimeString, toTimeString } from '@/utils/dateInput';
import { haptics } from '@/utils/haptics';
import { parseSpotLimit } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';
import { generateId } from '@/utils/uuid';

export interface VenueSetupValue {
  zones: VenueZoneDraft[];
  bookingTimes: string[];
  priceInfo: string;
  maxPartySize: string;
}

const MAX_ZONES = 8;
const MAX_TIMES = 8;

export function newZone(name = '', detail = '', capacity = ''): VenueZoneDraft {
  return { key: generateId(), id: null, name, detail, capacity };
}

/** At least one zone with a name and a capacity, and a valid party size. */
export function isVenueSetupValid(value: VenueSetupValue): boolean {
  const zonesOk = value.zones.length > 0 && value.zones.every((zone) => zone.name.trim().length > 0 && parseSpotLimit(zone.capacity) !== null);
  return zonesOk && parseSpotLimit(value.maxPartySize) !== null;
}

/** "21:00" + 60 → "22:00", wrapping past midnight. */
function addHour(time: string, hours: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (match === null) return time;
  const total = (Number(match[1]) * 60 + Number(match[2]) + hours * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Suggested arrival slots: the start time and the next two hours. */
export function suggestedTimes(startTime: string): string[] {
  const start = /^\d{1,2}:\d{2}$/.test(startTime.trim()) ? startTime.trim() : '21:00';
  return [start, addHour(start, 1), addHour(start, 2)];
}

/**
 * The venue part of a venue event: bookable zones with capacity, arrival
 * slots, the price line and the largest party one booking can hold. Shared by
 * the create wizard (app/create/venue.tsx) and the editor (app/venue-setup/[id].tsx).
 */
export function VenueSetupForm({
  value,
  onChange,
  startTime,
}: {
  value: VenueSetupValue;
  onChange: (patch: Partial<VenueSetupValue>) => void;
  startTime: string;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [pickingTime, setPickingTime] = useState(false);
  const total = value.zones.reduce((sum, zone) => sum + (parseSpotLimit(zone.capacity) ?? 0), 0);
  const chips = Array.from(new Set([...suggestedTimes(startTime), ...value.bookingTimes])).sort();

  const updateZone = (key: string, patch: Partial<VenueZoneDraft>) =>
    onChange({ zones: value.zones.map((zone) => (zone.key === key ? { ...zone, ...patch } : zone)) });

  const toggleTime = (time: string) => {
    haptics.tap();
    onChange({
      bookingTimes: value.bookingTimes.includes(time)
        ? value.bookingTimes.filter((x) => x !== time)
        : [...value.bookingTimes, time].sort(),
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('venue.setup.zonesTitle')}</Text>
        <Text style={[styles.sectionSub, { color: tokens.textSecondary }]}>{t('venue.setup.zonesSub')}</Text>
      </View>
      {value.zones.map((zone, index) => (
        <View key={zone.key} style={[styles.zone, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={styles.zoneHead}>
            <Text style={[styles.zoneLabel, { color: tokens.textSecondary }]}>{t('venue.setup.zoneLabel', { number: index + 1 })}</Text>
            {value.zones.length > 1 ? (
              <TouchableOpacity
                onPress={() => onChange({ zones: value.zones.filter((z) => z.key !== zone.key) })}
                accessibilityRole="button"
                accessibilityLabel={t('venue.setup.removeZone')}
                hitSlop={8}
              >
                <Feather name="x" size={18} color={tokens.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Field
            label={t('venue.setup.zoneName')}
            value={zone.name}
            onChangeText={(name) => updateZone(zone.key, { name })}
            placeholder={t('venue.setup.zoneNamePlaceholder')}
            // The placeholder reads like a value: say it's empty once the zone is otherwise filled in.
            error={zone.name.trim().length === 0 && (zone.capacity.length > 0 || zone.detail.trim().length > 0) ? t('venue.setup.nameRequired') : null}
          />
          <View style={styles.row}>
            <View style={styles.grow}>
              <Field
                label={t('venue.setup.zoneDetail')}
                value={zone.detail}
                onChangeText={(detail) => updateZone(zone.key, { detail })}
                placeholder={t('venue.setup.zoneDetailPlaceholder')}
              />
            </View>
            <View style={styles.capacity}>
              <Field
                label={t('venue.setup.zoneCapacity')}
                value={zone.capacity}
                onChangeText={(capacity) => updateZone(zone.key, { capacity: capacity.replace(/[^0-9]/g, '') })}
                placeholder="30"
                keyboardType="numeric"
                error={zone.name.trim().length > 0 && parseSpotLimit(zone.capacity) === null ? t('venue.setup.capacityRequired') : null}
              />
            </View>
          </View>
        </View>
      ))}
      {value.zones.length < MAX_ZONES ? (
        <Button label={t('venue.setup.addZone')} variant="ghost" onPress={() => onChange({ zones: [...value.zones, newZone()] })} />
      ) : null}
      <Text style={[styles.total, { color: tokens.textSecondary }]}>{t('venue.setup.totalCapacity', { count: total })}</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('venue.setup.timesTitle')}</Text>
        <Text style={[styles.sectionSub, { color: tokens.textSecondary }]}>{t('venue.setup.timesSub')}</Text>
      </View>
      <View style={styles.chips}>
        {chips.map((time) => {
          const on = value.bookingTimes.includes(time);
          return (
            <TouchableOpacity
              key={time}
              onPress={() => toggleTime(time)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[
                styles.chip,
                on ? { backgroundColor: tokens.accentFill, borderColor: tokens.accentFill } : { backgroundColor: tokens.surface, borderColor: tokens.border },
              ]}
            >
              <Text style={[styles.chipText, { color: on ? tokens.onAccent : tokens.textPrimary }]}>{time}</Text>
            </TouchableOpacity>
          );
        })}
        {value.bookingTimes.length < MAX_TIMES ? (
          <TouchableOpacity
            onPress={() => setPickingTime(true)}
            accessibilityRole="button"
            accessibilityLabel={t('venue.setup.addTime')}
            style={[styles.chip, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          >
            <Feather name="plus" size={16} color={tokens.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {pickingTime ? (
        <DateTimeField
          label={t('venue.setup.addTime')}
          mode="time"
          value={parseTimeString(startTime.trim().length > 0 ? startTime : '21:00')}
          displayValue={t('venue.setup.pickTime')}
          onChange={(selected) => {
            const time = toTimeString(selected);
            if (!value.bookingTimes.includes(time)) onChange({ bookingTimes: [...value.bookingTimes, time].sort() });
            setPickingTime(false);
          }}
        />
      ) : null}

      <Field
        label={t('venue.setup.priceLabel')}
        value={value.priceInfo}
        onChangeText={(priceInfo) => onChange({ priceInfo })}
        placeholder={t('venue.setup.pricePlaceholder')}
        hint={t('venue.setup.priceHint')}
      />
      <Field
        label={t('venue.setup.maxPartyLabel')}
        value={value.maxPartySize}
        onChangeText={(maxPartySize) => onChange({ maxPartySize: maxPartySize.replace(/[^0-9]/g, '') })}
        keyboardType="numeric"
        hint={t('venue.setup.maxPartyHint')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  section: {
    gap: 2,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  zone: {
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  zoneHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  grow: {
    flex: 1,
  },
  capacity: {
    width: 96,
  },
  total: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 38,
    minWidth: 60,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
