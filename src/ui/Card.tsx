import { View, type ViewProps } from "react-native";

import { radius } from "./theme";
import { useTheme } from "./ThemeContext";

export interface CardProps extends ViewProps {
  /** Token radius: sm 12 · md 18 · lg 26 */
  rounded?: keyof typeof radius;
  padded?: boolean;
  /**
   * surface — the default card, hairline border, no shadow.
   * invert  — the high-contrast panel (white on dark, near-black on light).
   *           One per screen; pair text with tone="onSurfaceHi".
   * accent  — the acid-lime tile. One per screen at most; text tone="onAccent".
   */
  variant?: "surface" | "invert" | "accent";
}

/**
 * Flat card. No gradient and no elevation: a 1px hairline reads as a card
 * edge for free, where stacked Android elevation costs a draw pass each.
 */
export function Card({
  rounded = "md",
  padded = true,
  variant = "surface",
  style,
  children,
  ...rest
}: CardProps) {
  const { colors } = useTheme();

  const background =
    variant === "invert"
      ? colors.surfaceHi
      : variant === "accent"
        ? colors.accent
        : colors.surface;

  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: radius[rounded],
          borderWidth: variant === "surface" ? 1 : 0,
          borderColor: colors.hairline,
          padding: padded ? 18 : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
