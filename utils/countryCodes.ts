import { COUNTRY_NAMES_RO } from '@/utils/countryNamesRo';

/** The phone-entry country-code picker's list: the markets this app is used in
 * most come first (Romania leading), then the rest of the world alphabetically.
 * Anything missing can be typed as a custom prefix in PhoneField's picker. */
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
  // Everything else, alphabetical. NANP islands (+1 xxx) are left out: they
  // share +1 with the US, so a custom prefix covers them.
  { iso: 'AF', dialCode: '+93', name: 'Afghanistan' },
  { iso: 'AL', dialCode: '+355', name: 'Albania' },
  { iso: 'DZ', dialCode: '+213', name: 'Algeria' },
  { iso: 'AD', dialCode: '+376', name: 'Andorra' },
  { iso: 'AO', dialCode: '+244', name: 'Angola' },
  { iso: 'AR', dialCode: '+54', name: 'Argentina' },
  { iso: 'AM', dialCode: '+374', name: 'Armenia' },
  { iso: 'AU', dialCode: '+61', name: 'Australia' },
  { iso: 'AZ', dialCode: '+994', name: 'Azerbaijan' },
  { iso: 'BH', dialCode: '+973', name: 'Bahrain' },
  { iso: 'BD', dialCode: '+880', name: 'Bangladesh' },
  { iso: 'BY', dialCode: '+375', name: 'Belarus' },
  { iso: 'BZ', dialCode: '+501', name: 'Belize' },
  { iso: 'BJ', dialCode: '+229', name: 'Benin' },
  { iso: 'BT', dialCode: '+975', name: 'Bhutan' },
  { iso: 'BO', dialCode: '+591', name: 'Bolivia' },
  { iso: 'BA', dialCode: '+387', name: 'Bosnia and Herzegovina' },
  { iso: 'BW', dialCode: '+267', name: 'Botswana' },
  { iso: 'BR', dialCode: '+55', name: 'Brazil' },
  { iso: 'BN', dialCode: '+673', name: 'Brunei' },
  { iso: 'BF', dialCode: '+226', name: 'Burkina Faso' },
  { iso: 'BI', dialCode: '+257', name: 'Burundi' },
  { iso: 'KH', dialCode: '+855', name: 'Cambodia' },
  { iso: 'CM', dialCode: '+237', name: 'Cameroon' },
  { iso: 'CV', dialCode: '+238', name: 'Cape Verde' },
  { iso: 'CF', dialCode: '+236', name: 'Central African Republic' },
  { iso: 'TD', dialCode: '+235', name: 'Chad' },
  { iso: 'CL', dialCode: '+56', name: 'Chile' },
  { iso: 'CN', dialCode: '+86', name: 'China' },
  { iso: 'CO', dialCode: '+57', name: 'Colombia' },
  { iso: 'KM', dialCode: '+269', name: 'Comoros' },
  { iso: 'CG', dialCode: '+242', name: 'Congo' },
  { iso: 'CD', dialCode: '+243', name: 'Congo (DR)' },
  { iso: 'CR', dialCode: '+506', name: 'Costa Rica' },
  { iso: 'CI', dialCode: '+225', name: "Côte d'Ivoire" },
  { iso: 'HR', dialCode: '+385', name: 'Croatia' },
  { iso: 'CU', dialCode: '+53', name: 'Cuba' },
  { iso: 'CY', dialCode: '+357', name: 'Cyprus' },
  { iso: 'CZ', dialCode: '+420', name: 'Czechia' },
  { iso: 'DK', dialCode: '+45', name: 'Denmark' },
  { iso: 'DJ', dialCode: '+253', name: 'Djibouti' },
  { iso: 'EC', dialCode: '+593', name: 'Ecuador' },
  { iso: 'EG', dialCode: '+20', name: 'Egypt' },
  { iso: 'SV', dialCode: '+503', name: 'El Salvador' },
  { iso: 'GQ', dialCode: '+240', name: 'Equatorial Guinea' },
  { iso: 'ER', dialCode: '+291', name: 'Eritrea' },
  { iso: 'EE', dialCode: '+372', name: 'Estonia' },
  { iso: 'SZ', dialCode: '+268', name: 'Eswatini' },
  { iso: 'ET', dialCode: '+251', name: 'Ethiopia' },
  { iso: 'FO', dialCode: '+298', name: 'Faroe Islands' },
  { iso: 'FJ', dialCode: '+679', name: 'Fiji' },
  { iso: 'FI', dialCode: '+358', name: 'Finland' },
  { iso: 'GA', dialCode: '+241', name: 'Gabon' },
  { iso: 'GM', dialCode: '+220', name: 'Gambia' },
  { iso: 'GE', dialCode: '+995', name: 'Georgia' },
  { iso: 'GH', dialCode: '+233', name: 'Ghana' },
  { iso: 'GI', dialCode: '+350', name: 'Gibraltar' },
  { iso: 'GL', dialCode: '+299', name: 'Greenland' },
  { iso: 'GT', dialCode: '+502', name: 'Guatemala' },
  { iso: 'GN', dialCode: '+224', name: 'Guinea' },
  { iso: 'GW', dialCode: '+245', name: 'Guinea-Bissau' },
  { iso: 'GY', dialCode: '+592', name: 'Guyana' },
  { iso: 'HT', dialCode: '+509', name: 'Haiti' },
  { iso: 'HN', dialCode: '+504', name: 'Honduras' },
  { iso: 'HK', dialCode: '+852', name: 'Hong Kong' },
  { iso: 'IS', dialCode: '+354', name: 'Iceland' },
  { iso: 'IN', dialCode: '+91', name: 'India' },
  { iso: 'ID', dialCode: '+62', name: 'Indonesia' },
  { iso: 'IR', dialCode: '+98', name: 'Iran' },
  { iso: 'IQ', dialCode: '+964', name: 'Iraq' },
  { iso: 'IL', dialCode: '+972', name: 'Israel' },
  { iso: 'JP', dialCode: '+81', name: 'Japan' },
  { iso: 'JO', dialCode: '+962', name: 'Jordan' },
  { iso: 'KZ', dialCode: '+7', name: 'Kazakhstan' },
  { iso: 'KE', dialCode: '+254', name: 'Kenya' },
  { iso: 'XK', dialCode: '+383', name: 'Kosovo' },
  { iso: 'KW', dialCode: '+965', name: 'Kuwait' },
  { iso: 'KG', dialCode: '+996', name: 'Kyrgyzstan' },
  { iso: 'LA', dialCode: '+856', name: 'Laos' },
  { iso: 'LV', dialCode: '+371', name: 'Latvia' },
  { iso: 'LB', dialCode: '+961', name: 'Lebanon' },
  { iso: 'LS', dialCode: '+266', name: 'Lesotho' },
  { iso: 'LR', dialCode: '+231', name: 'Liberia' },
  { iso: 'LY', dialCode: '+218', name: 'Libya' },
  { iso: 'LI', dialCode: '+423', name: 'Liechtenstein' },
  { iso: 'LT', dialCode: '+370', name: 'Lithuania' },
  { iso: 'LU', dialCode: '+352', name: 'Luxembourg' },
  { iso: 'MO', dialCode: '+853', name: 'Macau' },
  { iso: 'MG', dialCode: '+261', name: 'Madagascar' },
  { iso: 'MW', dialCode: '+265', name: 'Malawi' },
  { iso: 'MY', dialCode: '+60', name: 'Malaysia' },
  { iso: 'MV', dialCode: '+960', name: 'Maldives' },
  { iso: 'ML', dialCode: '+223', name: 'Mali' },
  { iso: 'MT', dialCode: '+356', name: 'Malta' },
  { iso: 'MR', dialCode: '+222', name: 'Mauritania' },
  { iso: 'MU', dialCode: '+230', name: 'Mauritius' },
  { iso: 'MX', dialCode: '+52', name: 'Mexico' },
  { iso: 'MC', dialCode: '+377', name: 'Monaco' },
  { iso: 'MN', dialCode: '+976', name: 'Mongolia' },
  { iso: 'ME', dialCode: '+382', name: 'Montenegro' },
  { iso: 'MA', dialCode: '+212', name: 'Morocco' },
  { iso: 'MZ', dialCode: '+258', name: 'Mozambique' },
  { iso: 'MM', dialCode: '+95', name: 'Myanmar' },
  { iso: 'NA', dialCode: '+264', name: 'Namibia' },
  { iso: 'NP', dialCode: '+977', name: 'Nepal' },
  { iso: 'NZ', dialCode: '+64', name: 'New Zealand' },
  { iso: 'NI', dialCode: '+505', name: 'Nicaragua' },
  { iso: 'NE', dialCode: '+227', name: 'Niger' },
  { iso: 'NG', dialCode: '+234', name: 'Nigeria' },
  { iso: 'MK', dialCode: '+389', name: 'North Macedonia' },
  { iso: 'NO', dialCode: '+47', name: 'Norway' },
  { iso: 'OM', dialCode: '+968', name: 'Oman' },
  { iso: 'PK', dialCode: '+92', name: 'Pakistan' },
  { iso: 'PS', dialCode: '+970', name: 'Palestine' },
  { iso: 'PA', dialCode: '+507', name: 'Panama' },
  { iso: 'PG', dialCode: '+675', name: 'Papua New Guinea' },
  { iso: 'PY', dialCode: '+595', name: 'Paraguay' },
  { iso: 'PE', dialCode: '+51', name: 'Peru' },
  { iso: 'PH', dialCode: '+63', name: 'Philippines' },
  { iso: 'PL', dialCode: '+48', name: 'Poland' },
  { iso: 'QA', dialCode: '+974', name: 'Qatar' },
  { iso: 'RU', dialCode: '+7', name: 'Russia' },
  { iso: 'RW', dialCode: '+250', name: 'Rwanda' },
  { iso: 'SM', dialCode: '+378', name: 'San Marino' },
  { iso: 'SA', dialCode: '+966', name: 'Saudi Arabia' },
  { iso: 'SN', dialCode: '+221', name: 'Senegal' },
  { iso: 'RS', dialCode: '+381', name: 'Serbia' },
  { iso: 'SC', dialCode: '+248', name: 'Seychelles' },
  { iso: 'SL', dialCode: '+232', name: 'Sierra Leone' },
  { iso: 'SG', dialCode: '+65', name: 'Singapore' },
  { iso: 'SK', dialCode: '+421', name: 'Slovakia' },
  { iso: 'SI', dialCode: '+386', name: 'Slovenia' },
  { iso: 'SO', dialCode: '+252', name: 'Somalia' },
  { iso: 'ZA', dialCode: '+27', name: 'South Africa' },
  { iso: 'KR', dialCode: '+82', name: 'South Korea' },
  { iso: 'SS', dialCode: '+211', name: 'South Sudan' },
  { iso: 'LK', dialCode: '+94', name: 'Sri Lanka' },
  { iso: 'SD', dialCode: '+249', name: 'Sudan' },
  { iso: 'SR', dialCode: '+597', name: 'Suriname' },
  { iso: 'SE', dialCode: '+46', name: 'Sweden' },
  { iso: 'SY', dialCode: '+963', name: 'Syria' },
  { iso: 'TW', dialCode: '+886', name: 'Taiwan' },
  { iso: 'TJ', dialCode: '+992', name: 'Tajikistan' },
  { iso: 'TZ', dialCode: '+255', name: 'Tanzania' },
  { iso: 'TH', dialCode: '+66', name: 'Thailand' },
  { iso: 'TG', dialCode: '+228', name: 'Togo' },
  { iso: 'TN', dialCode: '+216', name: 'Tunisia' },
  { iso: 'TR', dialCode: '+90', name: 'Turkey' },
  { iso: 'TM', dialCode: '+993', name: 'Turkmenistan' },
  { iso: 'UG', dialCode: '+256', name: 'Uganda' },
  { iso: 'UA', dialCode: '+380', name: 'Ukraine' },
  { iso: 'AE', dialCode: '+971', name: 'United Arab Emirates' },
  { iso: 'UY', dialCode: '+598', name: 'Uruguay' },
  { iso: 'UZ', dialCode: '+998', name: 'Uzbekistan' },
  { iso: 'VE', dialCode: '+58', name: 'Venezuela' },
  { iso: 'VN', dialCode: '+84', name: 'Vietnam' },
  { iso: 'YE', dialCode: '+967', name: 'Yemen' },
  { iso: 'ZM', dialCode: '+260', name: 'Zambia' },
  { iso: 'ZW', dialCode: '+263', name: 'Zimbabwe' },
];

/** "+40", "40", " + 4 0 " -> "+40"; null when it isn't 1-4 digits (ITU codes are at most 3, a few NANP ones read as 4). */
export function normalizeDialCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return /^[1-9]\d{0,3}$/.test(digits) ? `+${digits}` : null;
}

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

/** Same output shape as toStoredPhone (digits only, no `+`), but for a raw
 * string handed back by the device contacts picker instead of a separate
 * dial-code + local-number pair — those come in almost any format
 * (`+40 790 586 600`, `0790586600`, `0040790586600`, ...), so there's no
 * single known dial code to combine with. If the contact's own number
 * already carries a `+`, its digits are trusted as already having a country
 * code; a leading `00` international-dialing prefix is treated the same
 * way. Otherwise there's no country code to go on at all, so — per this
 * app's own "Romania first" default (DEFAULT_COUNTRY_CODE above) — it's
 * treated as a Romanian national number, same leading-zero handling as
 * toE164/toStoredPhone. This is a heuristic, not a real parser: a foreign
 * number typed locally with neither a `+` nor a `00` prefix will be
 * mis-normalized, same limitation any phone input without a country-code
 * picker has. */
export function normalizeToStoredPhone(raw: string): string {
  if (raw.includes('+')) {
    return raw.replace(/\D/g, '');
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return `${DEFAULT_COUNTRY_CODE.dialCode.replace('+', '')}${stripLeadingZero(digits)}`;
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

/** A stored phone (e.g. `40790586600`) as a display string (`+40 790 586 600`)
 * — splits into dial code + local number via splitStoredPhone, then groups
 * the local digits in 3s for readability. Purely cosmetic, never used for
 * comparison/storage. */
export function formatPhoneDisplay(stored: string): string {
  const { dialCode, localNumber } = splitStoredPhone(stored);
  const groups = localNumber.match(/.{1,3}/g) ?? [localNumber];
  return `${dialCode} ${groups.join(' ')}`;
}

/** 🇷🇴 from "RO": regional-indicator letters, same as the site's flagOf. */
export function flagOf(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((char) => 0x1f1a5 + char.charCodeAt(0)));
}

/** The country's name in the app's language (Romanian names come from the site's list). */
export function countryDisplayName(country: CountryCode, language: string): string {
  return language.startsWith('ro') ? (COUNTRY_NAMES_RO[country.iso] ?? country.name) : country.name;
}

/** The main markets at the top of the picker ("Cele mai folosite"), up to Greece, as on the site. */
export const MAIN_COUNTRY_COUNT = COUNTRY_CODES.findIndex((country) => country.iso === 'GR') + 1;
