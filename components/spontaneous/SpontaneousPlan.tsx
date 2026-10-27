import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Skeleton } from '@/components/Skeleton';
import { DeletableRow, Eyebrow, SpCard } from '@/components/spontaneous/parts';
import { useEventContent } from '@/hooks/useEventContent';
import { useSpontaneous } from '@/hooks/useSpontaneous';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import type { PlanItem, SpontaneousContent } from '@/types/spontaneous';
import { haptics } from '@/utils/haptics';
import { openInMaps } from '@/utils/maps';
import { templateMeta } from '@/utils/spontaneous';
import { themeRadius } from '@/utils/themeTokens';

/**
 * Detalii for a spontaneous event: the template's tool (song queue, who
 * brings what, wine sheet), then where it is.
 */
export function SpontaneousPlan({ event, owner }: { event: AppEvent; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const spontaneous = useSpontaneous(event.id);
  const { content: details } = useEventContent(event.id);
  const { content } = spontaneous;
  const template = event.template ?? 'party';
  const kind = templateMeta(event.template).planKind;
  const items = useMemo(() => (content?.planItems ?? []).filter((item) => item.kind === kind), [content, kind]);

  const venue = details?.venue;
  const placeName = venue !== undefined && venue.name.trim().length > 0 ? venue.name : event.location;
  const placeAddress = venue?.address ?? '';

  return (
    <GuestScreen transparent>
      <View style={styles.head}>
        <Eyebrow>{t(`spontaneous.templates.${template}.planTitle`)}</Eyebrow>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t(`spontaneous.templates.${template}.planSub`)}</Text>
      </View>

      {content === null ? (
        <SpCard>
          <Skeleton height={18} width="80%" radius={4} />
          <Skeleton height={18} width="65%" radius={4} />
          <Skeleton height={18} width="72%" radius={4} />
        </SpCard>
      ) : kind === 'song' ? (
        <SongQueue items={items} owner={owner} hook={spontaneous} />
      ) : kind === 'bring' ? (
        <BringList items={items} owner={owner} hook={spontaneous} />
      ) : kind === 'wine' ? (
        <WineSheet items={items} owner={owner} hook={spontaneous} content={content} />
      ) : null}

      <Eyebrow>{t('spontaneous.plan.logistics')}</Eyebrow>
      <SpCard>
        <View style={styles.placeRow}>
          <View style={[styles.pin, { backgroundColor: tokens.accentTint }]}>
            <Feather name="map-pin" size={18} color={tokens.accentText} />
          </View>
          <View style={styles.placeText}>
            <Text style={[styles.placeName, { color: tokens.textPrimary }]}>
              {placeName.trim().length > 0 ? placeName : t('spontaneous.plan.noPlace')}
            </Text>
            {placeAddress.trim().length > 0 ? (
              <Text style={[styles.placeAddress, { color: tokens.textSecondary }]}>{placeAddress}</Text>
            ) : null}
            {(venue?.notes ?? []).map((note) => (
              <Text key={note} style={[styles.placeAddress, { color: tokens.textSecondary }]}>
                {note}
              </Text>
            ))}
          </View>
        </View>
        {placeName.trim().length > 0 || placeAddress.trim().length > 0 ? (
          <Button
            label={t('spontaneous.plan.openMap')}
            variant="secondary"
            onPress={() =>
              openInMaps({
                name: placeName,
                address: placeAddress,
                latitude: venue?.latitude ?? null,
                longitude: venue?.longitude ?? null,
              })
            }
          />
        ) : null}
        {owner ? (
          <Button label={t('spontaneous.plan.editPlace')} variant="ghost" onPress={() => router.push(`/venue/${event.id}`)} />
        ) : null}
      </SpCard>
    </GuestScreen>
  );
}

type Hook = ReturnType<typeof useSpontaneous>;

/** One-line input + "+" button; resolves after the insert so the field clears only on success. */
function AddRow({
  placeholder,
  onAdd,
  secondPlaceholder,
}: {
  placeholder: string;
  secondPlaceholder?: string;
  onAdd: (title: string, detail: string | null) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const canAdd = title.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      await onAdd(title.trim(), detail.trim().length > 0 ? detail.trim() : null);
      setTitle('');
      setDetail('');
      haptics.press();
    } catch {
      // useSpontaneous already reported it.
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: tokens.surface, borderColor: tokens.border, color: tokens.textPrimary }];
  return (
    <View style={styles.addRow}>
      <View style={styles.addInputs}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={placeholder}
          placeholderTextColor={tokens.textMuted}
          style={input}
          returnKeyType={secondPlaceholder !== undefined ? 'next' : 'done'}
          onSubmitEditing={secondPlaceholder === undefined ? () => void submit() : undefined}
          maxLength={120}
        />
        {secondPlaceholder !== undefined ? (
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder={secondPlaceholder}
            placeholderTextColor={tokens.textMuted}
            style={input}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            maxLength={120}
          />
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => void submit()}
        disabled={!canAdd}
        accessibilityRole="button"
        accessibilityLabel={t('spontaneous.plan.add')}
        style={[styles.addButton, { backgroundColor: canAdd ? tokens.accentFill : tokens.surface2 }]}
      >
        <Feather name="plus" size={22} color={canAdd ? tokens.onAccent : tokens.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function SongQueue({ items, owner, hook }: { items: PlanItem[]; owner: boolean; hook: Hook }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const votes = (id: string) => hook.content?.itemVotes.filter((v) => v.itemId === id).length ?? 0;
  const ranked = [...items].sort((a, b) => votes(b.id) - votes(a.id) || a.createdAt.localeCompare(b.createdAt));

  return (
    <>
      <SpCard style={styles.listCard}>
        {ranked.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textSecondary }]}>{t('spontaneous.plan.songsEmpty')}</Text>
        ) : (
          ranked.map((item, index) => {
            const voted = hook.hasUpvoted(item.id);
            return (
              <DeletableRow key={item.id} enabled={owner || item.addedBy === hook.userId} title={item.title} onDelete={() => hook.removeItem(item.id)}>
                <View style={[styles.row, index > 0 && { borderTopColor: tokens.border, borderTopWidth: 1 }]}>
                  <Text style={[styles.rank, { color: tokens.accentText }]}>#{index + 1}</Text>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.rowSub, { color: tokens.textSecondary }]}>
                      {[item.detail, item.addedByLabel !== null ? t('spontaneous.plan.suggestedBy', { name: item.addedByLabel }) : null]
                        .filter((part): part is string => part !== null && part.length > 0)
                        .join(' · ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.tap();
                      hook.toggleUpvote(item.id);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: voted }}
                    accessibilityLabel={t('spontaneous.plan.upvote', { count: votes(item.id) })}
                    style={[
                      styles.pill,
                      voted
                        ? { backgroundColor: tokens.accentFill, borderColor: tokens.accentFill }
                        : { backgroundColor: tokens.surface, borderColor: tokens.border },
                    ]}
                  >
                    <Feather name="chevron-up" size={15} color={voted ? tokens.onAccent : tokens.textPrimary} />
                    <Text style={[styles.pillText, { color: voted ? tokens.onAccent : tokens.textPrimary }]}>{votes(item.id)}</Text>
                  </TouchableOpacity>
                </View>
              </DeletableRow>
            );
          })
        )}
      </SpCard>
      <AddRow
        placeholder={t('spontaneous.plan.songPlaceholder')}
        secondPlaceholder={t('spontaneous.plan.artistPlaceholder')}
        onAdd={(title, detail) => hook.addItem('song', title, detail)}
      />
    </>
  );
}

function BringList({ items, owner, hook }: { items: PlanItem[]; owner: boolean; hook: Hook }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const covered = items.filter((item) => item.claimedBy !== null).length;

  return (
    <>
      <SpCard style={styles.listCard}>
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textSecondary }]}>
            {owner ? t('spontaneous.plan.bringEmptyOwner') : t('spontaneous.plan.bringEmpty')}
          </Text>
        ) : (
          items.map((item, index) => {
            const mine = item.claimedBy !== null && item.claimedBy === hook.userId;
            const taken = item.claimedBy !== null && !mine;
            return (
              <DeletableRow key={item.id} enabled={owner} title={item.title} onDelete={() => hook.removeItem(item.id)}>
                <View style={[styles.row, index > 0 && { borderTopColor: tokens.border, borderTopWidth: 1 }]}>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.rowSub, { color: tokens.textSecondary }]}>
                      {item.claimedBy === null
                        ? t('spontaneous.plan.nobody')
                        : mine
                          ? t('spontaneous.plan.youBring')
                          : t('spontaneous.plan.bringsBy', { name: item.claimedByLabel ?? '' })}
                    </Text>
                  </View>
                  {taken ? (
                    <View style={[styles.doneDot, { backgroundColor: tokens.statusConfirmedSoft }]}>
                      <Feather name="check" size={15} color={tokens.statusConfirmed} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        haptics.tap();
                        hook.toggleClaim(item.id);
                      }}
                      accessibilityRole="button"
                      style={[
                        styles.pill,
                        mine
                          ? { backgroundColor: tokens.accentFill, borderColor: tokens.accentFill }
                          : { backgroundColor: tokens.surface, borderColor: tokens.accentPrimary },
                      ]}
                    >
                      {mine ? <Feather name="check" size={14} color={tokens.onAccent} /> : null}
                      <Text style={[styles.pillText, { color: mine ? tokens.onAccent : tokens.accentText }]}>
                        {mine ? t('spontaneous.plan.you') : t('spontaneous.plan.iBring')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </DeletableRow>
            );
          })
        )}
      </SpCard>
      {items.length > 0 ? (
        <Text style={[styles.footnote, { color: tokens.textSecondary }]}>
          {t('spontaneous.plan.covered', { covered, total: items.length })}
        </Text>
      ) : null}
      {owner ? (
        <AddRow placeholder={t('spontaneous.plan.bringPlaceholder')} onAdd={(title) => hook.addItem('bring', title, null)} />
      ) : null}
    </>
  );
}

function WineSheet({
  items,
  owner,
  hook,
  content,
}: {
  items: PlanItem[];
  owner: boolean;
  hook: Hook;
  content: SpontaneousContent;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const average = (id: string) => {
    const list = content.ratings.filter((r) => r.itemId === id);
    return list.length === 0 ? null : list.reduce((sum, r) => sum + r.stars, 0) / list.length;
  };
  const favourite = [...items]
    .filter((item) => hook.myRating(item.id) > 0)
    .sort((a, b) => hook.myRating(b.id) - hook.myRating(a.id))[0];

  return (
    <>
      <SpCard style={styles.listCard}>
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textSecondary }]}>
            {owner ? t('spontaneous.plan.winesEmptyOwner') : t('spontaneous.plan.winesEmpty')}
          </Text>
        ) : (
          items.map((item, index) => {
            const mine = hook.myRating(item.id);
            const avg = average(item.id);
            return (
              <DeletableRow key={item.id} enabled={owner} title={item.title} onDelete={() => hook.removeItem(item.id)}>
                <View style={[styles.row, index > 0 && { borderTopColor: tokens.border, borderTopWidth: 1 }]}>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: tokens.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.rowSub, { color: tokens.textSecondary }]}>
                      {[item.detail, avg !== null ? t('spontaneous.plan.groupAverage', { value: avg.toFixed(1) }) : null]
                        .filter((part): part is string => part !== null && part.length > 0)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => {
                          haptics.tap();
                          hook.rate(item.id, n);
                        }}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={t('spontaneous.plan.rateStars', { count: n })}
                      >
                        <Text style={[styles.star, { color: n <= mine ? tokens.accentGold : tokens.border }]}>★</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </DeletableRow>
            );
          })
        )}
      </SpCard>
      {items.length > 0 ? (
        <Text style={[styles.footnote, { color: tokens.textSecondary }]}>
          {favourite !== undefined ? t('spontaneous.plan.yourFav', { name: favourite.title }) : t('spontaneous.plan.rateHint')}
        </Text>
      ) : null}
      {owner ? (
        <AddRow
          placeholder={t('spontaneous.plan.winePlaceholder')}
          secondPlaceholder={t('spontaneous.plan.wineStylePlaceholder')}
          onAdd={(title, detail) => hook.addItem('wine', title, detail)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: 4,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
  },
  listCard: {
    paddingVertical: 4,
    gap: 0,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rank: {
    width: 28,
    fontSize: 14,
    fontWeight: '700',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12.5,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  doneDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    fontSize: 22,
  },
  footnote: {
    fontSize: 12.5,
    textAlign: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addInputs: {
    flex: 1,
    gap: 8,
  },
  input: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: {
    flex: 1,
    gap: 2,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '700',
  },
  placeAddress: {
    fontSize: 13,
  },
});
