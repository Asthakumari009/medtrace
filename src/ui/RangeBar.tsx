import { View } from "react-native";

import { useTheme } from "./ThemeContext";

export interface RangeBarProps {
  /** The measured value. */
  value: number;
  /** Normal range bounds. */
  low: number;
  high: number;
  flagged?: boolean;
}

/**
 * Parse a printed reference range like "12-15", "12 – 15.5" or "12 to 15".
 * Returns null for anything else (qualitative, one-sided, unparseable) —
 * callers simply skip the bar then.
 */
export function parseReferenceRange(range: string): { low: number; high: number } | null {
  const match = range
    .replace(/,/g, "")
    .match(/(-?\d+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (match === null) return null;
  const low = Number.parseFloat(match[1] ?? "");
  const high = Number.parseFloat(match[2] ?? "");
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null;
  return { low, high };
}

/**
 * Where a value sits against its printed normal range: a quiet track, the
 * normal band in soft sage, and a marker dot — sage inside, coral outside.
 * Decorative; the printed value + "Outside range" text carry the meaning.
 */
export function RangeBar({ value, low, high, flagged = false }: RangeBarProps) {
  const { colors } = useTheme();

  // Pad the domain so out-of-range markers still land inside the track.
  const pad = (high - low) * 0.4;
  const min = low - pad;
  const max = high + pad;
  const clamp = (n: number): number => Math.min(max, Math.max(min, n));
  const pct = (n: number): number => ((clamp(n) - min) / (max - min)) * 100;

  const bandLeft = pct(low);
  const bandWidth = pct(high) - bandLeft;
  const markerLeft = pct(value);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 8, justifyContent: "center" }}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.fill }} />
      <View
        style={{
          position: "absolute",
          left: `${bandLeft}%`,
          width: `${bandWidth}%`,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.fill,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: `${markerLeft}%`,
          marginLeft: -4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: flagged ? colors.alert : colors.ink,
        }}
      />
    </View>
  );
}
