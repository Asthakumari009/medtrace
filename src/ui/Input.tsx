import { useState } from "react";
import {
  TextInput,
  useWindowDimensions,
  type TextInputProps,
  type TextStyle,
} from "react-native";

import { fontStyle, radius, typeScale } from "./theme";
import { useTheme } from "./ThemeContext";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
}

/**
 * Standard text field: surface fill, hairline border that goes to ink on
 * focus and alert when invalid. No focus glow — a shadow that appears on
 * focus is an extra Android draw pass for no information.
 */
export function Input({
  invalid = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);

  const borderColor = invalid
    ? colors.alert
    : focused
      ? colors.ink
      : colors.hairline;

  const baseStyle: TextStyle = {
    minHeight: Math.max(52, typeScale.body * fontScale + 28),
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontSize: typeScale.body,
    color: colors.ink,
    ...fontStyle("regular"),
  };

  return (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      selectionColor={colors.accentInk}
      style={[baseStyle, style]}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...rest}
    />
  );
}
