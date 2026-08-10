import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import type { AppEvent } from '@/types/event';

import { formatEventDate } from './format';

/**
 * v1 has no server, so the "shareable link" is a deep link into this app.
 * Swapping this for a real https:// URL later is a one-line change.
 */
export function buildInviteLink(eventId: string): string {
  return Linking.createURL(`/invite/${eventId}`);
}

export function buildInviteMessage(event: AppEvent): string {
  return [
    event.name,
    formatEventDate(event.date),
    event.location.trim(),
    event.welcomeMessage.trim(),
    buildInviteLink(event.id),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function shareInvite(event: AppEvent): Promise<void> {
  await Share.share({
    title: event.name,
    message: buildInviteMessage(event),
  });
}
