import { Share } from 'react-native';

import type { AppEvent } from '@/types/event';

import { formatEventDate } from './format';
import { INVITE_SITE_URL } from './whatsappInvite';

/**
 * Event-level web link (the signed-in invite page on povestea-web). Guests
 * normally get their personal `/i/<token>` link instead — see
 * utils/whatsappInvite.ts; this one is for the generic share sheet.
 */
export function buildInviteLink(eventId: string): string {
  return `${INVITE_SITE_URL}/invite/${eventId}`;
}

/** Web page of the event's Live tab — what the QR on the Live card opens. */
export function buildLiveLink(eventId: string): string {
  return `${INVITE_SITE_URL}/event/${eventId}/live`;
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
