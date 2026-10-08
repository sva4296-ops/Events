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

const serifItalic = "PlayfairDisplay_500Medium_Italic";

/**
 * Loaded in app/_layout.tsx. A custom font's weight is its family, so pick
 * the family instead of setting fontWeight on these.
 */
export const typeface = {
  // Fraunces (warm serif, "story" feel) replaced Unbounded, which read heavy
  // and sprawling on small screens even at Medium.
  display: "Fraunces_600SemiBold",
  title: "Fraunces_600SemiBold",
  titleMedium: "Fraunces_500Medium",
  body: "SpaceGrotesk_400Regular",
  bodyMedium: "SpaceGrotesk_500Medium",
  bodySemiBold: "SpaceGrotesk_600SemiBold",
  bodyBold: "SpaceGrotesk_700Bold",
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
 * Type scale: Fraunces for titles and big numbers, Space Grotesk for
 * everything read quickly,
 * Playfair italic kept only for quotes. Colors are not part of the scale;
 * screens pair these with a token.
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
  quote: { fontFamily: serifItalic, fontSize: 17, lineHeight: 25 },
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
