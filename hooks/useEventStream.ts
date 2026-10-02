import { useQuery } from '@tanstack/react-query';

import { fetchEventStream } from '@/data/liveStreamRepository';

/** Polls the event's live video status (demo: polling, no Realtime). */
export function useEventStream(eventId: string | undefined) {
  return useQuery({
    queryKey: ['eventStream', eventId],
    queryFn: () => fetchEventStream(eventId ?? ''),
    enabled: eventId !== undefined,
    refetchInterval: 10_000,
  });
}
