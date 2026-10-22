import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Skeleton } from '@/components/Skeleton';
import { Avatar, Bar, Eyebrow, SpCard } from '@/components/spontaneous/parts';
import { useSpontaneous } from '@/hooks/useSpontaneous';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import type { Attendee } from '@/types/spontaneous';
import { haptics } from '@/utils/haptics';
import { formatMoney } from '@/utils/money';
import { billPaidCount, billPerPerson, templateMeta } from '@/utils/spontaneous';
import { bandGradientLocations, themeRadius, typography } from '@/utils/themeTokens';

/**
 * Fond for a spontaneous event: total ÷ people, who has paid, how to pay.
 * Money never goes through the app — a guest marks "sent", the organizer
 * ticks it off (guard_bill_confirmation keeps the tick organizer-only).
 */
export function SpontaneousBill({ event, owner }: { event: AppEvent; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { content, markSent, confirmPayment } = useSpontaneous(event.id);
  const meta = templateMeta(event.template);

  if (content === null) {
    return (
      <GuestScreen transparent>
        <Skeleton height={150} radius={24} />
        <SpCard>
          <Skeleton height={14} width="50%" radius={4} />
          <Skeleton height={10} radius={5} />
          <Skeleton height={14} width="70%" radius={4} />
        </SpCard>
      </GuestScreen>
    );
  }

  const { bill } = content;
  if (bill === null) {
    return (
      <GuestScreen transparent>
        <EmptyState
          message={owner ? t('spontaneous.bill.emptyOwner') : t('spontaneous.bill.emptyGuest')}
          action={owner ? <Button label={t('spontaneous.bill.create')} onPress={() => router.push(`/bill/${event.id}`)} /> : undefined}
        />
      </GuestScreen>
    );
  }

  const per = billPerPerson(bill);
  const payers = content.attendees.filter((a) => a.status === 'confirmed');
  const paid = billPaidCount(payers);
  const me = content.attendees.find((a) => a.isMe);

  return (
    <GuestScreen transparent>
      <LinearGradient
        colors={meta.band}
        locations={bandGradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={[styles.heroEyebrow, { color: meta.bandInk }]}>{t('spontaneous.bill.eyebrow').toUpperCase()}</Text>
        <Text style={[styles.heroTitle, { color: meta.bandInk }]}>{bill.title}</Text>
        <View style={styles.math}>
          <MathCell value={formatMoney(bill.totalAmount, 'lei')} label={t('spontaneous.bill.total')} ink={meta.bandInk} />
          <Text style={[styles.op, { color: meta.bandInk }]}>÷</Text>
          <MathCell value={String(bill.peopleCount)} label={t('spontaneous.bill.people')} ink={meta.bandInk} />
          <Text style={[styles.op, { color: meta.bandInk }]}>=</Text>
          <MathCell value={formatMoney(per, 'lei')} label={t('spontaneous.bill.perPerson')} ink={meta.bandInk} strong />
        </View>
      </LinearGradient>

      <SpCard>
        <Eyebrow right={`${Math.min(paid, bill.peopleCount)} / ${bill.peopleCount}`}>{t('spontaneous.bill.whoPaid')}</Eyebrow>
        <Bar ratio={paid / bill.peopleCount} />
        <PayerRow name={t('spontaneous.bill.host')} index={0} status="paid" />
        {payers.map((attendee, index) => (
          <PayerRow
            key={attendee.guestId}
            name={attendee.isMe ? `${attendee.name} (${t('spontaneous.plan.you')})` : attendee.name}
            index={index + 1}
            status={payStatus(attendee)}
            onConfirm={owner ? () => confirmPayment(attendee.guestId, attendee.billConfirmedAt === null) : undefined}
          />
        ))}
      </SpCard>

      <SpCard>
        <Text style={[styles.howTitle, { color: tokens.textPrimary }]}>{t('spontaneous.bill.howPay')}</Text>
        <Text style={[styles.howBody, { color: tokens.textSecondary }]}>
          {bill.paymentMethod.trim().length > 0 ? bill.paymentMethod : t('spontaneous.bill.noMethod')}
        </Text>
        {!owner && me !== undefined && me.status === 'confirmed' ? (
          me.billConfirmedAt !== null ? (
            <Text style={[styles.done, { color: tokens.statusConfirmed }]}>{t('spontaneous.bill.youPaidConfirmed')}</Text>
          ) : me.billSentAt !== null ? (
            <View style={styles.sentRow}>
              <Text style={[styles.done, { color: tokens.statusConfirmed }]}>{t('spontaneous.bill.youSent')}</Text>
              <TouchableOpacity onPress={() => markSent(me.guestId, false)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.undo, { color: tokens.textSecondary }]}>{t('spontaneous.bill.undo')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Button
              label={t('spontaneous.bill.iPaid', { amount: formatMoney(per, 'lei') })}
              onPress={() => {
                haptics.success();
                markSent(me.guestId, true);
              }}
            />
          )
        ) : null}
        {!owner && me?.status === 'maybe' ? (
          <Text style={[styles.howBody, { color: tokens.textSecondary }]}>{t('spontaneous.bill.maybeNote')}</Text>
        ) : null}
      </SpCard>

      <Text style={[styles.footnote, { color: tokens.textSecondary }]}>{t('spontaneous.bill.noMoney')}</Text>
    </GuestScreen>
  );
}

type PayStatus = 'paid' | 'sent' | 'due';

function payStatus(attendee: Attendee): PayStatus {
  if (attendee.billConfirmedAt !== null) return 'paid';
  return attendee.billSentAt !== null ? 'sent' : 'due';
}

function MathCell({ value, label, ink, strong = false }: { value: string; label: string; ink: string; strong?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellValue, strong && styles.cellStrong, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.cellLabel, { color: ink }]}>{label}</Text>
    </View>
  );
}

function PayerRow({
  name,
  index,
  status,
  onConfirm,
}: {
  name: string;
  index: number;
  status: PayStatus;
  /** Organizer only: tick off / undo. */
  onConfirm?: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const tone =
    status === 'paid'
      ? { fg: tokens.statusConfirmed, bg: tokens.statusConfirmedSoft, label: t('spontaneous.bill.paid') }
      : status === 'sent'
        ? { fg: tokens.accentText, bg: tokens.accentTint, label: t('spontaneous.bill.sent') }
        : { fg: tokens.statusPending, bg: tokens.statusPendingSoft, label: t('spontaneous.bill.due') };

  return (
    <View style={styles.payer}>
      <Avatar name={name} index={index} size={32} />
      <Text style={[styles.payerName, { color: tokens.textPrimary }]} numberOfLines={1}>
        {name}
      </Text>
      {onConfirm !== undefined && status !== 'paid' ? (
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            onConfirm();
          }}
          accessibilityRole="button"
          style={[styles.confirm, { borderColor: tokens.accentPrimary }]}
        >
          <Feather name="check" size={14} color={tokens.accentText} />
          <Text style={[styles.confirmText, { color: tokens.accentText }]}>{t('spontaneous.bill.confirm')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          disabled={onConfirm === undefined}
          onPress={onConfirm}
          accessibilityRole={onConfirm !== undefined ? 'button' : undefined}
          accessibilityHint={onConfirm !== undefined ? t('spontaneous.bill.undoHint') : undefined}
          style={[styles.status, { backgroundColor: tone.bg }]}
        >
          <Text style={[styles.statusText, { color: tone.fg }]}>{tone.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 20,
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.9,
  },
  heroTitle: {
    ...typography.title2,
  },
  math: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  cellValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  cellStrong: {
    fontSize: 20,
  },
  cellLabel: {
    fontSize: 11,
    opacity: 0.85,
  },
  op: {
    fontSize: 18,
    opacity: 0.7,
  },
  payer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payerName: {
    flex: 1,
    fontSize: 14.5,
  },
  status: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
  },
  confirmText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  howTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  howBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  done: {
    fontSize: 14,
    fontWeight: '600',
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  undo: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
