/** Small static list for the phone-entry country-code picker — not exhaustive,
 * just the markets this app is realistically used in today, Romania first
 * since that's the primary market (see CLAUDE.md's Romanian tax-id pattern
 * in agency signup for the same assumption). */
export interface CountryCode {
  iso: string;
  dialCode: string;
  name: string;
}

export const DEFAULT_COUNTRY_CODE: CountryCode = { iso: 'RO', dialCode: '+40', name: 'Romania' };

export const COUNTRY_CODES: CountryCode[] = [
  DEFAULT_COUNTRY_CODE,
  { iso: 'GB', dialCode: '+44', name: 'United Kingdom' },
  { iso: 'US', dialCode: '+1', name: 'United States' },
  { iso: 'CA', dialCode: '+1', name: 'Canada' },
  { iso: 'DE', dialCode: '+49', name: 'Germany' },
  { iso: 'FR', dialCode: '+33', name: 'France' },
  { iso: 'IT', dialCode: '+39', name: 'Italy' },
  { iso: 'ES', dialCode: '+34', name: 'Spain' },
  { iso: 'NL', dialCode: '+31', name: 'Netherlands' },
  { iso: 'BE', dialCode: '+32', name: 'Belgium' },
  { iso: 'AT', dialCode: '+43', name: 'Austria' },
  { iso: 'CH', dialCode: '+41', name: 'Switzerland' },
  { iso: 'IE', dialCode: '+353', name: 'Ireland' },
  { iso: 'PT', dialCode: '+351', name: 'Portugal' },
  { iso: 'HU', dialCode: '+36', name: 'Hungary' },
  { iso: 'BG', dialCode: '+359', name: 'Bulgaria' },
  { iso: 'MD', dialCode: '+373', name: 'Moldova' },
  { iso: 'GR', dialCode: '+30', name: 'Greece' },
];

/** Strips a leading 0 from a local number — the common "write it with a 0,
 * drop it when a country code is added" convention (e.g. 0790586600 ->
 * 790586600). Exported so PhoneField can apply it live as the user types,
 * not just at submit time. */
export function stripLeadingZero(value: string): string {
  return value.replace(/^0+/, '');
}

/** Strips everything but digits from the local part, drops a leading 0 (a
 * user-typed 0790586600 must become 790586600 before the country code is
 * prepended, or the result has an extra digit), then combines with the dial
 * code — so pasted formatting (spaces, dashes, parens) doesn't break the
 * E.164 result either. */
export function toE164(dialCode: string, localNumber: string): string {
  const digits = stripLeadingZero(localNumber.replace(/\D/g, ''));
  return `${dialCode}${digits}`;
}

/** Same digits as toE164, but without the leading `+` — this is the exact
 * format Supabase itself stores in auth.users.phone (confirmed against a
 * real row: `40790586600`, not `+40790586600`). Use this, never toE164,
 * anywhere a phone number is written to our own tables or compared against
 * auth.users.phone/public.users.phone — an exact-match column can't tolerate
 * the two formats disagreeing. toE164 stays `+`-prefixed because that's what
 * Supabase's signInWithOtp/verifyOtp need to actually route the SMS. */
export function toStoredPhone(dialCode: string, localNumber: string): string {
  return toE164(dialCode, localNumber).replace(/^\+/, '');
}

/** Reverse of toStoredPhone — splits a Supabase-stored phone (e.g.
 * `40790586600`) back into a dial code and local number so PhoneField can be
 * pre-filled with an existing value (edit-profile's phone field). Picks the
 * longest matching known dial code as the prefix; falls back to the default
 * country with the full digit string as the local number if nothing matches,
 * rather than throwing on an unrecognized prefix. */
export function splitStoredPhone(stored: string): { dialCode: string; localNumber: string } {
  const digits = stored.replace(/\D/g, '');
  const matches = COUNTRY_CODES.map((c) => c.dialCode.replace('+', '')).filter((code) =>
    digits.startsWith(code),
  );
  const best = matches.sort((a, b) => b.length - a.length)[0];
  if (best === undefined) {
    return { dialCode: DEFAULT_COUNTRY_CODE.dialCode, localNumber: digits };
  }
  return { dialCode: `+${best}`, localNumber: digits.slice(best.length) };
}
