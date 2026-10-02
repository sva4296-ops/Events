import { Linking, Platform, Share } from 'react-native';

import type { AppEvent, EventTypeId } from '@/types/event';
import { reportSupabaseError } from '@/utils/reportError';

/**
 * Base URL of the web RSVP site (separate Next.js repo, povestea-web). Each
 * guest's message links to their own `/i/<inviteToken>` page there, which
 * shows the invite and lets them confirm/decline with no login — see
 * supabase/migrations/20260929000001_guest_invite_tokens.sql. The same host is
 * declared in app.json (Android intentFilters + iOS associatedDomains), so
 * with the app installed the link opens app/i/[token].tsx instead. Change
 * both together when povesteanoastra.ro goes live.
 */
export const INVITE_SITE_URL = 'https://events-web-henna.vercel.app';

export interface GuestInviteMessageInput {
  /** Empty string when the organizer didn't type a name. */
  guestName: string;
  event: Pick<AppEvent, 'type' | 'name' | 'date' | 'location'>;
  inviteToken: string;
}

export function buildGuestInviteLink(inviteToken: string): string {
  return `${INVITE_SITE_URL}/i/${inviteToken}`;
}

/** Per-type emoji and closing line. Memorial stays sober: no emoji, no "!". */
const TYPE_COPY: Record<EventTypeId, { emoji: string; line: string }> = {
  wedding: { emoji: '💍', line: 'Ne-ar bucura să fii alături de noi în ziua cea mare.' },
  baptism: { emoji: '🍼', line: 'Ne-ar bucura să fii alături de noi la acest început de drum.' },
  birthday: { emoji: '🎂', line: 'Ne-ar bucura să sărbătorim împreună.' },
  cause: { emoji: '💚', line: 'Ne-ar bucura să fii alături de noi pentru această cauză.' },
  corporate: { emoji: '🏢', line: 'Ne-ar bucura să fii prezent.' },
  memorial: { emoji: '', line: 'Prezența ta ne-ar fi de mare sprijin.' },
  other: { emoji: '✨', line: 'Ne-ar bucura să fii alături de noi.' },
};

/** The message is always Romanian, so the date is too, regardless of the
 * organizer's app language. Unparseable input is kept as typed. */
function formatInviteDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Bună Maria! 💍
 * Te invităm cu drag la „Nunta Ana & Mihai”. Ne-ar bucura să fii alături de noi în ziua cea mare.
 *
 * 📅 sâmbătă, 12 septembrie 2026
 * 📍 Castelul Cantacuzino, Bușteni
 *
 * Invitația ta personală, unde poți confirma dacă ajungi:
 * https://…/i/<token>
 */
export function buildGuestInviteMessage({ guestName, event, inviteToken }: GuestInviteMessageInput): string {
  const copy = TYPE_COPY[event.type];
  const name = guestName.trim();
  const memorial = event.type === 'memorial';
  const greeting = memorial
    ? name.length > 0 ? `Bună ziua, ${name},` : 'Bună ziua,'
    : `${name.length > 0 ? `Bună ${name}!` : 'Bună!'} ${copy.emoji}`;
  const intro = memorial
    ? `Te invităm la „${event.name.trim()}”. ${copy.line}`
    : `Te invităm cu drag la „${event.name.trim()}”. ${copy.line}`;

  const date = formatInviteDate(event.date);
  const location = event.location.trim();
  const details = [date !== null ? `📅 ${date}` : null, location.length > 0 ? `📍 ${location}` : null].filter(
    (line): line is string => line !== null,
  );

  return [
    greeting,
    intro,
    ...(details.length > 0 ? ['', ...details] : []),
    '',
    'Invitația ta personală, unde poți confirma dacă ajungi:',
    buildGuestInviteLink(inviteToken),
  ].join('\n');
}

/**
 * `phone` must already be in international format, digits only — no leading
 * `+`, no spaces (the exact format utils/countryCodes.ts's toStoredPhone
 * produces, and what's already written to event_guests.guest_phone, so
 * callers reuse the same value for both rather than reformatting).
 */
export function buildGuestInviteWhatsAppUrl(phone: string, input: GuestInviteMessageInput): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildGuestInviteMessage(input))}`;
}

/**
 * Opens WhatsApp pre-filled with the invite message; falls back to the
 * native share sheet if it can't be opened, so the action never silently
 * does nothing. Best-effort by design — errors are reported (never thrown)
 * so a failure here can't be mistaken for the guest invite itself failing,
 * since by the time this runs the event_guests row has already been saved.
 *
 * Returns whether the wa.me link was actually opened via Linking.openURL —
 * `false` covers both the share-sheet fallback and an outright error.
 * app/add-guest/[id].tsx (the single-invite flow) ignores this;
 * app/send-invites/[id].tsx (the bulk queue) uses it to decide whether to
 * mark whatsapp_sent_at — only a confirmed WhatsApp open counts as "sent,"
 * not "the organizer shared it some other way."
 *
 * Reports via reportSupabaseError, this app's one existing generic
 * "something went wrong" surface (utils/reportError.ts) — there is no
 * Sentry integration anywhere in this codebase (checked again for this
 * change); using the real existing convention instead of adding a new one.
 *
 * Note: `Linking.canOpenURL` on an `https://` URL like this typically
 * resolves `true` regardless of whether WhatsApp itself is installed, since
 * a browser can open it too — wa.me itself handles that case (offers to
 * open the WhatsApp app or falls back to WhatsApp Web). The share-sheet
 * fallback below is still real and still fires as specified, just less
 * often in practice than "WhatsApp isn't installed" alone would suggest.
 */
export async function sendGuestWhatsAppInvite(
  phone: string,
  input: GuestInviteMessageInput,
): Promise<boolean> {
  const message = buildGuestInviteMessage(input);
  const url = buildGuestInviteWhatsAppUrl(phone, input);

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    await Share.share({ message });
    return false;
  } catch (err) {
    reportSupabaseError(err);
    return false;
  }
}

/**
 * SMS alternative for guests without WhatsApp: opens the Messages app with the
 * same message and personal link. iOS separates the body with `&`, Android
 * with `?`. No canOpenURL check (iOS would need `sms` in
 * LSApplicationQueriesSchemes); a failed open falls back to the share sheet.
 * Same return contract as sendGuestWhatsAppInvite: true only when the SMS
 * composer actually opened.
 */
export async function sendGuestSmsInvite(phone: string, input: GuestInviteMessageInput): Promise<boolean> {
  const message = buildGuestInviteMessage(input);
  const url = `sms:+${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    try {
      await Share.share({ message });
    } catch (err) {
      reportSupabaseError(err);
    }
    return false;
  }
}

/**
 * Co-organizer invite (app/co-organizers/[id].tsx). No personal token: access
 * comes from signing in with this same phone number (event_members auto-link,
 * 20261002000002_event_co_organizers.sql). The link is the site's landing page.
 */
export function buildCoOrganizerMessage(name: string, eventName: string): string {
  const trimmed = name.trim();
  return [
    `${trimmed.length > 0 ? `Bună ${trimmed}!` : 'Bună!'} Te-am adăugat co-organizator la „${eventName.trim()}” în PovesteaNoastra.`,
    '',
    'Descarcă aplicația și intră cu acest număr de telefon. Evenimentul apare la „Evenimentele mele”:',
    INVITE_SITE_URL,
  ].join('\n');
}

/** WhatsApp or SMS with a prepared message; share-sheet fallback, never throws. */
export async function sendPhoneMessage(phone: string, message: string, channel: 'whatsapp' | 'sms'): Promise<void> {
  const url =
    channel === 'whatsapp'
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `sms:+${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
  } catch {
    try {
      await Share.share({ message });
    } catch (err) {
      reportSupabaseError(err);
    }
  }
}
