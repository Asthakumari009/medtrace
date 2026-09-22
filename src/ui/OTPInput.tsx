import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import { enterUp } from "./motion";
import { Text } from "./Text";
import { radius } from "./theme";
import { useTheme } from "./ThemeContext";

export interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Six-cell one-time-code input backed by a single hidden TextInput,
 * so paste and keyboard autofill work naturally.
 */
export function OTPInput({
  length = 6,
  value,
  onChange,
  invalid = false,
  autoFocus = true,
}: OTPInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const cells = Array.from({ length }, (_, i) => value[i] ?? "");
  const activeIndex = Math.min(value.length, length - 1);

  // Slimmer cells past 6 digits so longer codes still fit on small screens.
  const cellWidth = length > 6 ? 36 : 48;
  const cellGap = length > 6 ? 6 : 8;

  return (
    <Pressable
      accessibilityLabel={`${length}-digit verification code`}
      onPress={() => inputRef.current?.focus()}
    >
      <View style={{ flexDirection: "row", gap: cellGap, justifyContent: "center" }}>
        {cells.map((digit, i) => {
          const isActive = focused && i === activeIndex && value.length < length;
          const borderColor = invalid
            ? colors.alert
            : isActive
              ? colors.ink
              : colors.hairline;
          return (
            <Animated.View
              key={i}
              entering={enterUp(i)}
              style={{
                width: cellWidth,
                height: 56,
                borderRadius: radius.sm,
                borderWidth: 1.5,
                borderColor,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="heading">{digit}</Text>
            </Animated.View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(raw) => onChange(raw.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={length}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ position: "absolute", width: "100%", height: "100%", opacity: 0 }}
      />
    </Pressable>
  );
}
