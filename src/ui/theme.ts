import { Easing, Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * MedTrace design tokens v4 — "Record".
 *
 * Near-black canvas, flat surfaces, one acid-lime accent, tight geometric
 * type, and numbers as the hero element. Flat by design: no gradients, no
 * blur, no overshoot. Every color, size, radius, duration, and easing in the
 * app resolves through useTheme() or this file; nothing outside it defines a
 * value.
 *
 * The register is also the cheapest thing to render on a mid-range Android
 * device, which is why it is the register.
 */

export type ColorScheme = "light" | "dark";

/** Bone canvas, white cards, one inverted near-black panel per screen. */
const lightColors = {
  // Canvas
  bg: "#F4F5F1",
  bgDeep: "#E9EBE4",
  surface: "#FFFFFF",

  /** The inverted panel — near-black card on the light canvas. One per screen. */
  surfaceHi: "#101210",
  onSurfaceHi: "#F5F7F2",
  onSurfaceHiSoft: "rgba(245,247,242,0.62)",
  onSurfaceHiFaint: "rgba(245,247,242,0.40)",

  /**
   * Acid lime. A FILL ONLY — always paired with onAccent text, never used as
   * a text or icon color on bg/surface (it fails contrast there). Budget:
   * one element per screen.
   */
  accent: "#C8F02A",
  accentSoft: "rgba(200,240,42,0.16)",
  /** Text-safe lime for accent labels and icons: 5.9:1 on white. */
  accentInk: "#5A6B00",
  onAccent: "#0F1200",

  // Ink
  ink: "#101210",
  inkSoft: "rgba(16,18,16,0.62)",
  inkFaint: "rgba(16,18,16,0.58)",

  /** Abnormal lab values and errors only. 5.3:1 on white. */
  alert: "#C43A1C",
  alertSoft: "rgba(196,58,28,0.10)",
  /** In-range / success. 5.3:1 on white. */
  ok: "#1F7A48",

  hairline: "rgba(16,18,16,0.09)",
  /** Neutral fill for icon chips, skeletons, off-toggle tracks, quiet wells. */
  fill: "rgba(16,18,16,0.05)",
  /** Backdrop behind sheets and overlays. */
  scrim: "rgba(10,11,10,0.44)",
} as const;

export type ColorPalette = { readonly [K in keyof typeof lightColors]: string };

/** The primary scheme: near-black canvas, white inverted cards, same lime. */
const darkColors: ColorPalette = {
  bg: "#0A0B0A",
  bgDeep: "#000000",
  surface: "#16181A",

  /** Inverted here means white — the bright tiles in the reference. */
  surfaceHi: "#FFFFFF",
  onSurfaceHi: "#101210",
  onSurfaceHiSoft: "rgba(16,18,16,0.64)",
  onSurfaceHiFaint: "rgba(16,18,16,0.44)",

  accent: "#D8FF3E",
  accentSoft: "rgba(216,255,62,0.14)",
  /** On dark the lime is already text-safe (15.6:1 on surface). */
  accentInk: "#D8FF3E",
  onAccent: "#0F1200",

  ink: "#F5F7F2",
  inkSoft: "rgba(245,247,242,0.60)",
  inkFaint: "rgba(245,247,242,0.50)",

  /** 6.4:1 on surface. */
  alert: "#FF6B4A",
  alertSoft: "rgba(255,107,74,0.14)",
  /** 11.9:1 on surface. */
  ok: "#7FE7A4",

  hairline: "rgba(245,247,242,0.10)",
  fill: "rgba(245,247,242,0.06)",
  scrim: "rgba(0,0,0,0.62)",
};

export const palettes: Record<ColorScheme, ColorPalette> = {
  light: lightColors,
  dark: darkColors,
};

export const typeScale = {
  eyebrow: 11,
  caption: 12,
  label: 14,
  body: 16,
  heading: 20,
  title: 30,
  display: 44,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export const space = (n: number): number => n * 4;

export const SCREEN_PADDING = 20;

/**
 * Floating tab bar geometry. Screen's tabbed clearance derives from these so
 * scrollable content always ends tab-bar height + 16 above the screen bottom.
 */
export const TAB_BAR_HEIGHT = 62;
/** Gap between the tab bar and the home indicator / safe-area edge. */
export const TAB_BAR_OFFSET = 12;

/**
 * Durations, in ms. Nothing in the app animates for longer than `slow`.
 * There is no spring: the house motion decelerates to rest and never
 * overshoots. Presses acknowledge, they do not squish.
 */
export const DUR = { fast: 110, base: 180, slow: 260 } as const;

/** Decelerate to rest. The default for entrances, presses, and layout. */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
/** Symmetric, for things that move and come back (sheets, toggles). */
export const EASE_IN_OUT = Easing.bezier(0.4, 0, 0.2, 1);

export const STAGGER_MS = 30;

/** Digits must not jitter. Every metric, lab value, and chart label uses this. */
export const tabularNums: TextStyle = { fontVariant: ["tabular-nums"] };

/**
 * One elevation, on the two surfaces that genuinely float (tab bar, sheet).
 * Everywhere else a 1px hairline does the job for free — stacked Android
 * elevation is extra draw passes, and the reference design uses borders.
 */
export const liftShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  default: { elevation: 8, shadowColor: "#000000" },
});

type FontWeight = "regular" | "medium" | "semibold";

/** Geist — geometric grotesk. Three weights; nothing else is loaded. */
const geist: Record<FontWeight, string> = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
};

export function fontStyle(weight: FontWeight): TextStyle {
  return { fontFamily: geist[weight] };
}

/** Keep scroll content clear of navigation at larger system text sizes. */
export const scaledTabBarHeight = (fontScale: number) =>
  TAB_BAR_HEIGHT + 4 + Math.max(0, (fontScale - 1) * 36);
