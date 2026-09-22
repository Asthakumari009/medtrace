import {
  ActivityIndicator,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { PressableScale, type PressableScaleProps } from "./PressableScale";
import { Text } from "./Text";
import { radius } from "./theme";
import { useTheme } from "./ThemeContext";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "sm";

export interface ButtonProps
  extends Omit<PressableScaleProps, "children" | "style"> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const heightBySize: Record<ButtonSize, number> = { md: 52, sm: 44 };

/**
 * Primary: the acid-lime pill with near-black text — the one loud element on
 * a screen. Secondary: surface + hairline. Ghost: bare accent label.
 * Flat fills only, so there is nothing to composite per frame.
 */
export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled === true || loading;
  const labelTone =
    variant === "primary" ? "onAccent" : variant === "ghost" ? "accent" : "ink";

  const inner = loading ? (
    <ActivityIndicator
      size="small"
      color={variant === "primary" ? colors.onAccent : colors.ink}
    />
  ) : (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon}
      <Text
        variant="label"
        tone={labelTone}
        style={{ flexShrink: 1, textAlign: "center" }}
      >
        {title}
      </Text>
    </View>
  );

  return (
    <PressableScale
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        {
          minHeight: heightBySize[size],
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled && !loading ? 0.4 : 1,
        },
        variant === "primary" ? { backgroundColor: colors.accent } : null,
        variant === "secondary"
          ? {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.hairline,
            }
          : null,
        style,
      ]}
      {...rest}
    >
      {inner}
    </PressableScale>
  );
}
