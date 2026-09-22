import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { fontStyle, tabularNums, typeScale } from "./theme";
import { useTheme } from "./ThemeContext";

export type TextVariant =
  | "display"
  | "metric"
  | "title"
  | "heading"
  | "body"
  | "label"
  | "caption"
  | "eyebrow";

export type TextTone =
  | "ink"
  | "soft"
  | "faint"
  | "accent"
  | "alert"
  | "ok"
  | "onAccent"
  | "onSurfaceHi"
  | "onSurfaceHiSoft";

/**
 * Tight tracking on the large sizes is where this type system gets its look —
 * roughly -3.5% at display, easing to zero by label. `metric` is display with
 * tabular figures, for any number the user reads as data.
 */
const variantStyles: Record<TextVariant, TextStyle> = {
  display: {
    fontSize: typeScale.display,
    lineHeight: 46,
    letterSpacing: -1.6,
    ...fontStyle("semibold"),
  },
  metric: {
    fontSize: typeScale.display,
    lineHeight: 46,
    letterSpacing: -1.6,
    ...fontStyle("semibold"),
    ...tabularNums,
  },
  title: {
    fontSize: typeScale.title,
    lineHeight: 34,
    letterSpacing: -1,
    ...fontStyle("semibold"),
  },
  heading: {
    fontSize: typeScale.heading,
    lineHeight: 26,
    letterSpacing: -0.5,
    ...fontStyle("semibold"),
  },
  body: {
    fontSize: typeScale.body,
    lineHeight: 24,
    letterSpacing: -0.1,
    ...fontStyle("regular"),
  },
  label: {
    fontSize: typeScale.label,
    lineHeight: 20,
    ...fontStyle("medium"),
  },
  caption: {
    fontSize: typeScale.caption,
    lineHeight: 17,
    letterSpacing: 0.1,
    ...fontStyle("regular"),
  },
  /** The micro-label above a value: "POLICY NUMBER", "DOCUMENTS". */
  eyebrow: {
    fontSize: typeScale.eyebrow,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    ...fontStyle("medium"),
  },
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

export function Text({
  variant = "body",
  tone = "ink",
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();

  const toneColors: Record<TextTone, string> = {
    ink: colors.ink,
    soft: colors.inkSoft,
    faint: colors.inkFaint,
    accent: colors.accentInk,
    alert: colors.alert,
    ok: colors.ok,
    onAccent: colors.onAccent,
    onSurfaceHi: colors.onSurfaceHi,
    onSurfaceHiSoft: colors.onSurfaceHiSoft,
  };

  return (
    <RNText
      style={[variantStyles[variant], { color: toneColors[tone] }, style]}
      {...rest}
    />
  );
}
