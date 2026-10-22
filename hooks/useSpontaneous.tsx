import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { showDialog } from '@/components/ActionSheet';
import {
  addPlanItem,
  claimPlanItem,
  deleteBillSplit,
  deletePlanItem,
  deletePoll,
  loadSpontaneous,
  ratePlanItem,
  saveBillSplit,
  savePoll,
  setBillConfirmed,
  setBillSent,
  setPlanItemVote,
  votePoll,
} from '@/data/spontaneousRepository';
import { useAuth } from '@/hooks/useAuth';
import type { BillSplit, PlanItemKind, PollOption, SpontaneousContent } from '@/types/spontaneous';
import i18n from '@/utils/i18n';
import { reportSupabaseError, supabaseErrorMessage } from '@/utils/reportError';

type Patch = (current: SpontaneousContent) => SpontaneousContent;

interface Write {
  run: () => Promise<void>;
  /** Optimistic cache patch, rolled back by the refetch on error. */
  patch?: Patch;
  /** Guest list rows changed too (bill status lives on event_guests). */
  touchesGuests?: boolean;
}

/**
 * Plain react-query hook (no provider), same shape as useEventContent. One
 * query per event, ['spontaneous', eventId]. No Realtime here (Chat is the
 * only subscription in the app), so it polls every 20s while mounted: votes
 * and "who brings what" are what other guests change.
 */
export function useSpontaneous(eventId: string, enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = useMemo(() => ['spontaneous', eventId] as const, [eventId]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadSpontaneous(eventId),
    enabled: enabled && eventId.length > 0 && userId !== null,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const mutation = useMutation({
    mutationFn: (write: Write) => write.run(),
    onMutate: async (write) => {
      if (write.patch === undefined) return;
      await queryClient.cancelQueries({ queryKey });
      const patch = write.patch;
      queryClient.setQueryData<SpontaneousContent>(queryKey, (current) => (current === undefined ? current : patch(current)));
    },
    onError: (error) => {
      const message = supabaseErrorMessage(error);
      if (message.includes('already_claimed')) {
        showDialog({ title: i18n.t('spontaneous.plan.alreadyClaimed') });
      } else {
        reportSupabaseError(error);
      }
    },
    onSettled: (_data, _error, write) => {
      void queryClient.invalidateQueries({ queryKey });
      if (write.touchesGuests === true) void queryClient.invalidateQueries({ queryKey: ['events', userId] });
    },
  });
  const { mutate, mutateAsync } = mutation;

  const content = query.data ?? null;

  // ---------------------------------------------------------------- vote
  const myPollVote = useMemo(
    () => content?.pollVotes.find((vote) => vote.userId === userId)?.optionId ?? null,
    [content, userId],
  );

  const vote = useCallback(
    (optionId: string) => {
      const poll = content?.poll;
      if (poll == null || userId === null) return;
      mutate({
        run: () => votePoll(poll.id, userId, optionId),
        patch: (current) => ({
          ...current,
          pollVotes: [...current.pollVotes.filter((v) => v.userId !== userId), { userId, optionId }],
        }),
      });
    },
    [content, userId, mutate],
  );

  const savePollAsync = useCallback(
    (question: string, options: PollOption[]) => mutateAsync({ run: () => savePoll(eventId, question, options) }),
    [eventId, mutateAsync],
  );

  const removePoll = useCallback(
    () => mutate({ run: () => deletePoll(eventId), patch: (current) => ({ ...current, poll: null, pollVotes: [] }) }),
    [eventId, mutate],
  );

  // ---------------------------------------------------------------- plan
  const addItem = useCallback(
    (kind: PlanItemKind, title: string, detail: string | null) =>
      mutateAsync({ run: () => addPlanItem(eventId, kind, title, detail, content?.planItems.length ?? 0) }),
    [eventId, content, mutateAsync],
  );

  const removeItem = useCallback(
    (itemId: string) =>
      mutate({
        run: () => deletePlanItem(itemId),
        patch: (current) => ({ ...current, planItems: current.planItems.filter((item) => item.id !== itemId) }),
      }),
    [mutate],
  );

  const hasUpvoted = useCallback(
    (itemId: string) => content?.itemVotes.some((v) => v.itemId === itemId && v.userId === userId) ?? false,
    [content, userId],
  );

  const toggleUpvote = useCallback(
    (itemId: string) => {
      if (userId === null) return;
      const voted = !hasUpvoted(itemId);
      mutate({
        run: () => setPlanItemVote(itemId, userId, voted),
        patch: (current) => ({
          ...current,
          itemVotes: voted
            ? [...current.itemVotes, { itemId, userId }]
            : current.itemVotes.filter((v) => !(v.itemId === itemId && v.userId === userId)),
        }),
      });
    },
    [userId, hasUpvoted, mutate],
  );

  const myRating = useCallback(
    (itemId: string) => content?.ratings.find((r) => r.itemId === itemId && r.userId === userId)?.stars ?? 0,
    [content, userId],
  );

  const rate = useCallback(
    (itemId: string, stars: number) => {
      if (userId === null) return;
      mutate({
        run: () => ratePlanItem(itemId, userId, stars),
        patch: (current) => ({
          ...current,
          ratings: [...current.ratings.filter((r) => !(r.itemId === itemId && r.userId === userId)), { itemId, userId, stars }],
        }),
      });
    },
    [userId, mutate],
  );

  const toggleClaim = useCallback(
    (itemId: string) => mutate({ run: () => claimPlanItem(itemId) }),
    [mutate],
  );

  // ---------------------------------------------------------------- bill
  const saveBillAsync = useCallback(
    (bill: Omit<BillSplit, 'eventId'>) => mutateAsync({ run: () => saveBillSplit({ ...bill, eventId }) }),
    [eventId, mutateAsync],
  );

  const removeBill = useCallback(
    () => mutate({ run: () => deleteBillSplit(eventId), patch: (current) => ({ ...current, bill: null }) }),
    [eventId, mutate],
  );

  const markSent = useCallback(
    (guestId: string, sent: boolean) =>
      mutate({
        run: () => setBillSent(guestId, sent),
        touchesGuests: true,
        patch: (current) => ({
          ...current,
          attendees: current.attendees.map((a) =>
            a.guestId === guestId ? { ...a, billSentAt: sent ? new Date().toISOString() : null } : a,
          ),
        }),
      }),
    [mutate],
  );

  const confirmPayment = useCallback(
    (guestId: string, confirmed: boolean) =>
      mutate({
        run: () => setBillConfirmed(guestId, confirmed),
        touchesGuests: true,
        patch: (current) => ({
          ...current,
          attendees: current.attendees.map((a) =>
            a.guestId === guestId ? { ...a, billConfirmedAt: confirmed ? new Date().toISOString() : null } : a,
          ),
        }),
      }),
    [mutate],
  );

  return {
    content,
    userId,
    myPollVote,
    vote,
    savePoll: savePollAsync,
    removePoll,
    addItem,
    removeItem,
    hasUpvoted,
    toggleUpvote,
    myRating,
    rate,
    toggleClaim,
    saveBill: saveBillAsync,
    removeBill,
    markSent,
    confirmPayment,
  };
}
