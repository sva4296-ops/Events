import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import ro from '@/locales/ro.json';

export const SUPPORTED_LANGUAGES = ['en', 'ro'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_KEY = 'povesteanoastra:language:v1';

/**
 * English for everyone by default, regardless of device locale — this pass
 * deliberately does not auto-detect device language (e.g. via
 * expo-localization). A language the user previously chose in Profile is
 * still restored below; that's a saved preference, not detection.
 */
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ro: { translation: ro },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    // React already escapes rendered text; i18next's own escaping would double-escape it.
    escapeValue: false,
  },
});

void AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
  if (stored === 'en' || stored === 'ro') {
    void i18n.changeLanguage(stored);
  }
});

/** Switches the active language immediately (no restart) and persists the choice. */
export async function setLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Worst case the choice doesn't survive a restart; the live switch above still applied.
  }
}

/**
 * TODO — screens still on hardcoded text, not migrated to t() yet.
 *
 * Wired: Home (app/index.tsx), Auth (app/auth/index.tsx), Profile
 * (app/profile.tsx), all 6 guest tabs (app/guest/[id]/*.tsx → `acasa.*`/
 * `detalii.*`/`fond.*`/`chat.*`/`live.*`/`album.*`), the RSVP screen
 * (app/invite/[id].tsx → `rsvp.*`), the organizer dashboard
 * (app/event/[id].tsx → `event.*`), and all 7 owner composer forms —
 * app/schedule, app/venue, app/menu, app/table, app/accommodation,
 * app/vendor, app/fund (each `[id].tsx` → its own `*Form` namespace:
 * `scheduleForm`/`venueForm`/`menuForm`/`tableForm`/`accommodationForm`/
 * `vendorForm`/`fundForm`), plus Edit Event (app/edit-event/[id].tsx →
 * `editEventForm.*`), Add Guest (app/add-guest/[id].tsx → `addGuestForm.*`),
 * Post a Moment (app/post-moment/[id].tsx → `postMomentForm.*`), Onboarding
 * (app/onboarding.tsx → `onboarding.*`), and the 4-step create-event wizard
 * (app/create/{type,details,preview,share}.tsx → `createWizard.*`) —
 * **every real screen in the app is now migrated** except the checkout stub
 * and one fallback string, both listed below. Also wired:
 * `components/DateTimeField.tsx`'s "Done" button (→ `common.done`) and the
 * shared components/utils these screens touch (EventListItem, RsvpBadge,
 * MomentCard, utils/format.ts's formatEventDate).
 *
 * The create wizard leans hard on reuse rather than new keys, since 3 of its
 * 4 steps repeat text from screens already migrated: `create/details.tsx`'s
 * field labels are `editEventForm.nameLabel`/`dateLabel`/`selectDate`/
 * `locationLabel`/`welcomeMessageLabel` (identical field set to Edit Event),
 * and `create/share.tsx` reuses `rsvp.notFoundTitle`, `event.shareInvitation`,
 * `event.previewAsGuest`, and `common.done`. Two of `create/details.tsx`'s
 * placeholders were already-English text needing only a Romanian
 * translation rather than the usual reverse (`"We'd love to have you..."`);
 * one (`"Casa Regală, Brașov"`) got the same treatment as other placeholder
 * venue names — translated to keep it recognizable as the same place
 * ("The Royal House, Brașov") rather than swapped for a generic example.
 *
 * The 7 composer forms share a lot of near-identical copy — "Not available"
 * + "Only the organizer can edit X.", "Guests will see this on the Detalii
 * tab.", "Save changes" — factored into `common.notAvailable`/
 * `common.guestsSeeOnDetalii`/`common.saveChanges` rather than repeated per
 * namespace. `app/menu/[id].tsx`'s course-name field labels reuse
 * `detalii.courseStarter`/`courseMain`/`courseDessert` (same words the
 * guest-facing Detalii screen already has). Every placeholder example
 * (`"Ceremony"`, `"Castle Hotel"`, etc.) was translated too, not just labels
 * — they were Romanian-only in the English-language organizer screens
 * before this pass, which was exactly the language-mixing problem this
 * whole effort exists to fix. Add Guest reuses three keys from other
 * namespaces rather than duplicating them: `auth.errors.invalidEmail`,
 * `auth.emailLabel`, and `auth.emailPlaceholder` (identical email-validation
 * copy to the Auth screen), and `event.inviteGuest` for its own header title
 * (same "Invite a guest" text the dashboard's button already uses to get
 * here).
 *
 * MessageBubble needed no changes — sender_label/content are user content,
 * and its relative-time stamp already goes through utils/relativeTime.ts,
 * which is on the still-hardcoded list below. "LIVE" (`live.liveTag`) is
 * translated to the same value in both languages on purpose — it's already
 * the word used in Romanian too — kept as a real key rather than hardcoded
 * so a future rebrand of that word only needs a locale-file edit.
 *
 * Detalii's dietary-preference pills are a special case worth re-reading if
 * you touch that section again: DIETARY_OPTIONS stays a fixed, untranslated
 * array (those are the literal values stored in and compared against
 * `event_guests.dietary_preferences`) — only the pill's rendered label goes
 * through `t()`, via DIETARY_LABEL_KEY. Don't translate DIETARY_OPTIONS
 * itself; that would silently desync stored preferences from the active
 * language's comparison.
 *
 * Onboarding's STEPS array is a similar pattern worth reusing elsewhere: it
 * used to hold literal Romanian title/body text, and `item.title` doubled as
 * the React `key` in the `.map()` below it. Translating the text directly
 * would have made the `key` change on every language switch (React would
 * unmount/remount every slide on `changeLanguage()`). Fixed by storing
 * `titleKey`/`bodyKey` locale-key *names* in STEPS instead of literal text —
 * those never change, so `key={item.titleKey}` stays stable, and `t()` is
 * only called at render time inside the `.map()`. Any other array whose
 * items double as list content and a React key should use this shape.
 *
 * Not started at all — still fully hardcoded, no locale keys authored yet:
 *   - app/checkout/[id].tsx (stub, low priority — no real content to translate yet)
 *   - hooks/useGuestEvent.tsx's FALLBACK_NAME ('Evenimentul nostru') — a
 *     fallback event name shown only if `event` is somehow still undefined
 *     after load; small enough that it wasn't bundled into this pass
 *
 * Worth doing as their own pass rather than per-screen, since each is a
 * single shared file used everywhere:
 *   - utils/confirm.ts — the "Renunță"/"Șterge" confirm-dialog buttons used
 *     by every delete flow in the app
 *   - utils/relativeTime.ts — timeAgo/timeOfDay relative-time strings
 *   - utils/eventTypes.ts — event type display labels (wedding/baptism/etc.)
 *
 * See CLAUDE.md's i18n section for the full writeup.
 */

export default i18n;
