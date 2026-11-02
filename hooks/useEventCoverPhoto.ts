import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  removeEventCoverPhoto,
  setEventCoverPhoto,
} from '@/data/eventsRepository';
import type { AppEvent } from '@/types/event';
import { processMomentPhoto, type PickedPhoto } from '@/utils/imageProcessing';
import { reportSupabaseError } from '@/utils/reportError';

/** Setting and removing the event's own cover photo; EventCover draws it. */
export function useEventCoverPhoto(event: AppEvent) {
  const queryClient = useQueryClient();
  const path = event.coverPhotoPath ?? null;

  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['events'] });

  const setMutation = useMutation({
    mutationFn: async (photo: PickedPhoto) =>
      setEventCoverPhoto(event.id, await processMomentPhoto(photo), path),
    onSettled,
    onError: reportSupabaseError,
  });

  const removeMutation = useMutation({
    mutationFn: () => removeEventCoverPhoto(event.id, path ?? ''),
    onSettled,
    onError: reportSupabaseError,
  });

  return {
    path,
    busy: setMutation.isPending || removeMutation.isPending,
    setPhoto: setMutation.mutate,
    removePhoto: removeMutation.mutate,
  };
}
