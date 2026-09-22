import * as Haptics from "expo-haptics";
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { DUR, EASE_OUT } from "./theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Disable the haptic tick (e.g. inside scrolling lists). */
  haptic?: boolean;
}

/**
 * The house press behavior: 0.98 on a 110ms decelerating curve with a light
 * haptic tick, back to rest on release. A press acknowledges the touch — it
 * does not squish, and it does not bounce back. Minimum 44pt touch target.
 */
export function PressableScale({
  style,
  haptic = true,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      hitSlop={4}
      style={[{ minHeight: 44, minWidth: 44 }, animatedStyle, style]}
      onPressIn={(e) => {
        scale.value = withTiming(0.98, { duration: DUR.fast, easing: EASE_OUT });
        if (haptic) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => undefined,
          );
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: DUR.fast, easing: EASE_OUT });
        onPressOut?.(e);
      }}
      {...rest}
      {...(Platform.OS === "web"
        ? {
            "aria-selected":
              rest.accessibilityRole === "tab"
                ? rest.accessibilityState?.selected
                : undefined,
            "aria-pressed":
              rest.accessibilityRole !== "tab"
                ? rest.accessibilityState?.selected
                : undefined,
            "aria-checked": rest.accessibilityState?.checked,
            "aria-expanded": rest.accessibilityState?.expanded,
            "aria-busy": rest.accessibilityState?.busy,
          }
        : {})}
    />
  );
}
