import { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { select } from "@/lib/haptics";

import { DUR, EASE_IN_OUT } from "./theme";
import { useTheme } from "./ThemeContext";

export interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB = 22;
const INSET = 3;

/** House switch: lime track when on, sliding thumb, selection haptic. */
export function Toggle({
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: ToggleProps) {
  const { colors } = useTheme();

  // interpolateColor needs a real NUMBER for progress. A plain shared value
  // driven from an effect always reads back 0..1; wrapping the animation
  // inside useDerivedValue re-inits the worklet on every render and
  // transiently yields NaN, which Reanimated 4 turns into a fatal
  // rgba(NaN…) color.
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: DUR.base,
      easing: EASE_IN_OUT,
    });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.fill, colors.accent],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * (TRACK_WIDTH - THUMB - INSET * 2) },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      style={{
        minHeight: 44,
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
      onPress={() => {
        select();
        onChange(!value);
      }}
    >
      <Animated.View
        style={[
          {
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            padding: INSET,
            justifyContent: "center",
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: value ? colors.onAccent : colors.surface,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
