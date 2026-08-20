import { Linking, Share } from 'react-native';

import { reportSupabaseError } from '@/utils/reportError';

/**
 * Placeholder until the real web login page exists — every guest invite
 * message links here. One constant, swapped in one place once the site is
 * live; nothing else in this file (or its caller) hardcodes the URL.
 */
export const GUEST_LOGIN_URL = 'https://povesteanoastra.ro';

/** "Bună Maria, vrem..." / "Bună, vrem..." when no name was given. */
export function buildGuestInviteMessage(name: string): string {
  const greeting = name.trim().length > 0 ? `Bună ${name.trim()},` : 'Bună,';
  return (
    `${greeting} vrem să te invităm la un party! Loghează-te cu numărul tău de telefon pe ` +
    `povesteanoastra.ro pentru a putea accepta invitația și a urmări ce se întâmplă: ${GUEST_LOGIN_URL}`
  );
}

/**
 * `phone` must already be in international format, digits only — no leading
 * `+`, no spaces (the exact format utils/countryCodes.ts's toStoredPhone
 * produces, and what's already written to event_guests.guest_phone, so
 * callers reuse the same value for both rather than reformatting).
 */
export function buildGuestInviteWhatsAppUrl(phone: string, name: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildGuestInviteMessage(name))}`;
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
export async function sendGuestWhatsAppInvite(phone: string, name: string): Promise<boolean> {
  const message = buildGuestInviteMessage(name);
  const url = buildGuestInviteWhatsAppUrl(phone, name);

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
