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

/** Strips everything but digits from the local part before combining, so
 * pasted formatting (spaces, dashes, parens) doesn't break the E.164 result. */
export function toE164(dialCode: string, localNumber: string): string {
  return `${dialCode}${localNumber.replace(/\D/g, '')}`;
}
