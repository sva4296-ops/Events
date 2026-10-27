import type { TextStyle } from "react-native";

import type { Gradient } from "@/types/event";

/**
 * "Warm Story" theme tokens — the canonical light/dark palette for screens
 * migrated to ThemeProvider (see hooks/useTheme.tsx). Deliberately a third
 * token source alongside utils/theme.ts (organizer screens) and
 * utils/guestTheme.ts (guest tabs, still both light-mode-only) rather than a
 * replacement for either — same "separate palette per surface" precedent
 * those two already established. Screens read this file only once migrated;
 * see CLAUDE.md §2 for the running per-screen migration list.
 */

interface ShadowStyle {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export interface ThemeTokens {
  mode: "light" | "dark";
  /** Font family for display text (greeting, event names, big numbers). Per theme. */
  displayFont: string;
  background: Gradient;
  surface: string;
  surfaceElevated: string;
  /** A muted inner-panel/"slot" surface, distinct from `surface`/`surfaceElevated` —
   * for content nested a level deeper than a card (e.g. an empty photo slot, a
   * QR/info panel inside a card), where the card's own surface color wouldn't
   * read as a distinct region. */
  surfaceMuted: string;
  /** Light mode only — dark mode relies on `surfaceBorder` alone (no shadow). */
  surfaceElevatedShadow: ShadowStyle | null;
  /** 1px card border. Warm Story 2.0 sets it in both modes (light pairs it with the shadow). */
  surfaceBorder: string | null;
  textPrimary: string;
  textSecondary: string;
  /** Warm Story 2.0: placeholders and disabled labels. */
  textMuted: string;
  /** Warm Story 2.0: 1px outlines and separators — cards, fields, dividers. */
  border: string;
  /** Warm Story 2.0: quiet fills — chips, stepper buttons, disabled buttons. */
  surface2: string;
  accentPrimary: string;
  /** Warm Story 2.0: primary button fill — darker than accentPrimary for AA with white text. */
  accentFill: string;
  /** Text/icon color on accentFill. */
  onAccent: string;
  /** Selected/tonal backgrounds and the 4px focus ring. */
  accentTint: string;
  /** Links and tonal-button labels — accent that passes AA as text. */
  accentText: string;
  accentGold: string;
  accentPink: string;
  statusConfirmed: string;
  statusConfirmedSoft: string;
  statusPending: string;
  statusPendingSoft: string;
  statusDeclined: string;
  statusDeclinedSoft: string;
  destructive: string;
  destructiveSoft: string;
  tabBar: {
    background: string;
    active: string;
    inactive: string;
  };
}

/** 16–18px everywhere a card rounds its corners; not mode-dependent. */
export const themeRadius = {
  sm: 12,
  md: 16,
  lg: 18,
  /** Warm Story 2.0: small cards and tiles. */
  xl: 22,
  /** Warm Story 2.0: large cards (event card, invitation). */
  xxl: 26,
  /** Warm Story 2.0: bottom sheets. */
  sheet: 30,
  pill: 999,
} as const;

export const lightTheme: ThemeTokens = {
  mode: "light",
  displayFont: "BricolageGrotesque_600SemiBold",
  // Sand beige (was cream to peach #FFF8F1 -> #FBEAE0): neutral, so each
  // event's own colors (cover, accent) stand out.
  background: ["#F7F3EC", "#ECE4D7"],
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  // Reuses the background gradient's second stop rather than a new hex —
  // warm and light enough to sit under a white card while still reading as
  // a distinct region.
  surfaceMuted: "#ECE4D7",
  // Warm Story 2.0: 0 6 20 rgba(43,39,64,.07).
  surfaceElevatedShadow: {
    shadowColor: "#2B2740",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  // Warm Story 2.0: light cards carry the hairline border too, alongside the shadow.
  surfaceBorder: "#E3DACC",
  textPrimary: "#2B2740",
  // Warm Story 2.0: darkened from #8A8496 for 5.3:1 on cream.
  textSecondary: "#6E6880",
  textMuted: "#8A8496",
  border: "#E3DACC",
  surface2: "#F1ECE3",
  accentPrimary: "#7F77DD",
  accentFill: "#6A61D1",
  onAccent: "#FFFFFF",
  accentTint: "#EEECFB",
  accentText: "#5B53C4",
  accentGold: "#F5C36B",
  accentPink: "#E8779E",
  // Warm Story 2.0: status text tones darkened for AA on their soft fills.
  statusConfirmed: "#1F7A51",
  statusConfirmedSoft: "#E3F4EB",
  statusPending: "#8A5A0A",
  statusPendingSoft: "#FDF1DC",
  statusDeclined: "#B5335F",
  statusDeclinedSoft: "#FCE6EE",
  destructive: "#D9534F",
  destructiveSoft: "#FCEDEC",
  tabBar: {
    // Matches surfaceElevated above (white card surface) rather than the
    // dark-mode navy-purple bar — the light "Warm Story" theme uses white
    // cards throughout (see EmptyState), and the floating tab bar is one.
    // Warm Story 2.0: docked bar, near-opaque surface; active = accentText on an accentTint pill.
    background: "rgba(255,255,255,0.96)",
    active: "#5B53C4",
    inactive: "#6E6880",
  },
};

export const darkTheme: ThemeTokens = {
  mode: "dark",
  displayFont: "BricolageGrotesque_600SemiBold",
  background: ["#1E1A30", "#1E1A30"],
  surface: "#2A2440",
  surfaceElevated: "#2A2440",
  // Reuses the background gradient's first stop — darker than `surface`,
  // same "borrow the background stop" approach as the light theme above.
  surfaceMuted: "#1E1A30",
  surfaceElevatedShadow: null,
  surfaceBorder: "#3D3659",
  textPrimary: "#F4F1FA",
  textSecondary: "#B4ADC7",
  textMuted: "#8F88A6",
  border: "#3D3659",
  surface2: "#342D4E",
  accentPrimary: "#9B93F0",
  accentFill: "#9B93F0",
  onAccent: "#1E1A30",
  accentTint: "#37305A",
  accentText: "#BDB7F7",
  accentGold: "#F5C36B",
  accentPink: "#F08FB3",
  statusConfirmed: "#6DD3A0",
  statusConfirmedSoft: "#1F3B30",
  statusPending: "#F5C36B",
  statusPendingSoft: "#3E3322",
  statusDeclined: "#F08FB3",
  statusDeclinedSoft: "#45263A",
  destructive: "#E8726E",
  destructiveSoft: "#3A2229",
  tabBar: {
    background: "rgba(42,36,64,0.97)",
    active: "#BDB7F7",
    inactive: "#B4ADC7",
  },
};

/** The six themes the user picks from in Profile. */
export type ThemeId =
  | "hartie" | "sampanie" | "minimal" | "bleumarin" | "teracota" | "visina"
  | "sepia" | "retro" | "cinema";
export const THEME_IDS: readonly ThemeId[] = [
  "hartie", "sampanie", "minimal", "bleumarin", "teracota", "visina", "sepia", "retro", "cinema",
];
export const DEFAULT_THEME: ThemeId = "teracota";

interface Palette {
  mode: "light" | "dark";
  displayFont: string;
  background: string;
  surface: string;
  surface2: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentTint: string;
  accentText: string;
}

/** Builds a full token set from a small palette; status tones come from the light/dark base. */
function makeTheme(p: Palette): ThemeTokens {
  const base = p.mode === "dark" ? darkTheme : lightTheme;
  return {
    ...base,
    mode: p.mode,
    displayFont: p.displayFont,
    background: [p.background, p.background],
    surface: p.surface,
    surfaceElevated: p.surface,
    surfaceMuted: p.surface2,
    surfaceBorder: p.border,
    surfaceElevatedShadow: p.mode === "light" ? { ...lightTheme.surfaceElevatedShadow!, shadowOpacity: 0.05 } : null,
    textPrimary: p.textPrimary,
    textSecondary: p.textSecondary,
    textMuted: p.textMuted,
    border: p.border,
    surface2: p.surface2,
    accentPrimary: p.accent,
    accentFill: p.accent,
    onAccent: p.onAccent,
    accentTint: p.accentTint,
    accentText: p.accentText,
    tabBar: { background: p.surface, active: p.accentText, inactive: p.textSecondary },
  };
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  // A1 · Hârtie: paper, ink, burgundy.
  hartie: makeTheme({
    mode: "light", displayFont: "Newsreader_400Regular",
    background: "#F3EEE4", surface: "#FAF7F0", surface2: "#E8E0D2", border: "#DCD3C3",
    textPrimary: "#1E1B18", textSecondary: "#5F584E", textMuted: "#8A8276",
    accent: "#6E2430", onAccent: "#FFFFFF", accentTint: "#EFE0DF", accentText: "#6E2430",
  }),
  // A2 · Șampanie: near-black with champagne gold.
  sampanie: makeTheme({
    mode: "dark", displayFont: "CormorantGaramond_500Medium",
    background: "#121211", surface: "#1B1A18", surface2: "#252320", border: "#2F2C27",
    textPrimary: "#EEE7D9", textSecondary: "#A39C8F", textMuted: "#7A7469",
    accent: "#C9A55C", onAccent: "#121211", accentTint: "#2E281C", accentText: "#D9B972",
  }),
  // A3 · Minimal: white, grey, forest green.
  minimal: makeTheme({
    mode: "light", displayFont: "InstrumentSans_600SemiBold",
    background: "#FFFFFF", surface: "#F3F3F1", surface2: "#E4E4E1", border: "#E4E4E1",
    textPrimary: "#141414", textSecondary: "#5E5E5E", textMuted: "#8C8C8C",
    accent: "#2D4A3E", onAccent: "#FFFFFF", accentTint: "#E3ECE7", accentText: "#2D4A3E",
  }),
  // B1 · Bleumarin & coral.
  bleumarin: makeTheme({
    mode: "dark", displayFont: "Lora_400Regular",
    background: "#111827", surface: "#18223A", surface2: "#202C46", border: "#26324D",
    textPrimary: "#EEF1F6", textSecondary: "#A3ADC1", textMuted: "#78839A",
    accent: "#E07A62", onAccent: "#1A1210", accentTint: "#3A2A2E", accentText: "#EE927C",
  }),
  // B2 · Teracotă: warm and bright.
  teracota: makeTheme({
    mode: "light", displayFont: "Lora_400Regular",
    background: "#EEE5D9", surface: "#FFFFFF", surface2: "#E2D5C3", border: "#E0D4C4",
    textPrimary: "#2A211C", textSecondary: "#6A5E54", textMuted: "#958879",
    accent: "#A54E36", onAccent: "#FFFFFF", accentTint: "#F3E2DA", accentText: "#9A462F",
  }),
  // B3 · Vișină & roz pudrat.
  visina: makeTheme({
    mode: "dark", displayFont: "Lora_700Bold",
    background: "#221316", surface: "#2E1A1F", surface2: "#3D2329", border: "#45272E",
    textPrimary: "#F6E7E9", textSecondary: "#C3A7AC", textMuted: "#937A7F",
    accent: "#E8B4B8", onAccent: "#2A1418", accentTint: "#4A2A31", accentText: "#EFC3C6",
  }),
  // Vintage · Sepia: an old photograph, faded browns.
  sepia: makeTheme({
    mode: "light", displayFont: "Newsreader_400Regular",
    background: "#EADFCB", surface: "#F5EDDD", surface2: "#DCCDB2", border: "#D3C2A4",
    textPrimary: "#3A2A1C", textSecondary: "#6B5640", textMuted: "#937D63",
    accent: "#7A4E2D", onAccent: "#FFFFFF", accentTint: "#E8D7C0", accentText: "#6E4527",
  }),
  // Vintage · Retro '70s: mustard, burnt orange, brown.
  retro: makeTheme({
    mode: "light", displayFont: "Lora_700Bold",
    background: "#F1E2C2", surface: "#FBF2DE", surface2: "#E7D2A8", border: "#DEC796",
    textPrimary: "#3B2412", textSecondary: "#6A4A2E", textMuted: "#957552",
    accent: "#B5541C", onAccent: "#FFFFFF", accentTint: "#F3DCC0", accentText: "#9E4513",
  }),
  // Vintage · Cinema: an old movie theatre, dark with brass.
  cinema: makeTheme({
    mode: "dark", displayFont: "CormorantGaramond_500Medium",
    background: "#1C1712", surface: "#26201A", surface2: "#312920", border: "#3A3026",
    textPrimary: "#ECDDC2", textSecondary: "#B3A286", textMuted: "#857660",
    accent: "#C8984A", onAccent: "#1C1712", accentTint: "#3A2E1E", accentText: "#D9AE64",
  }),
};

/** Warm Story 2.0 "story thread": gold → pink → purple. Same in both modes. */
export const brandGradient = ["#F5C36B", "#E8779E", "#7F77DD"] as const;

/** Stop positions for the 135° type/brand bands (0 / 55% / 100%). */
export const bandGradientLocations = [0, 0.55, 1] as const;

/** Primary button glow: 0 8 20 rgba(106,97,209,.28), light mode only. */
export const accentButtonShadow = {
  shadowColor: "#6A61D1",
  shadowOpacity: 0.28,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

/** Warm Story 2.0 WhatsApp button fill (AA with white text). */
export const whatsappFill = "#1F7A51";

/**
 * Loaded in app/_layout.tsx. A custom font's weight is its family, so pick
 * the family instead of setting fontWeight on these.
 */
export const typeface = {
  // Exactly four font files: Bricolage Grotesque 600 for display text,
  // titles and big numbers; Instrument Sans 400/500/600 for everything else.
  display: "BricolageGrotesque_600SemiBold",
  title: "BricolageGrotesque_600SemiBold",
  titleMedium: "BricolageGrotesque_600SemiBold",
  body: "InstrumentSans_400Regular",
  bodyMedium: "InstrumentSans_500Medium",
  bodySemiBold: "InstrumentSans_600SemiBold",
  // No 700 file is loaded; the old bold slot maps to 600.
  bodyBold: "InstrumentSans_600SemiBold",
} as const;

/** GeneratedAvatar colors (same in both modes) and the face drawn on them. */
export const avatarPalette = [
  "#FF8A65",
  "#7CC4FF",
  "#FFD166",
  "#6DD3A0",
  "#B39DFF",
] as const;
export const avatarInk = "#0F1220";

/** Text and scrim over a cover photo: always light text on a dark fade, in both modes. */
export const onImage = "#FFFFFF";
export const onImageMuted = "rgba(255,255,255,0.85)";
export const imageScrim = ["rgba(15,18,32,0)", "rgba(15,18,32,0.78)"] as const;
/** Extra shade over a finished event's cover, so past events read as switched off. */
export const pastCoverShade = "rgba(15,18,32,0.6)";

/**
 * Type scale: Bricolage Grotesque for titles and big
 * numbers, Instrument Sans for everything read quickly. Colors are not part
 * of the scale; screens pair these with a token.
 */
export const typography = {
  display: {
    fontFamily: typeface.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  title1: {
    fontFamily: typeface.title,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  title2: {
    fontFamily: typeface.title,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.1,
  },
  quote: { fontFamily: typeface.body, fontSize: 17, lineHeight: 25 },
  subtitle: { fontFamily: typeface.bodyBold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: typeface.body, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: typeface.body, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: typeface.bodySemiBold, fontSize: 13, lineHeight: 18 },
  note: { fontFamily: typeface.bodyMedium, fontSize: 12, lineHeight: 16 },
  overline: {
    fontFamily: typeface.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;
