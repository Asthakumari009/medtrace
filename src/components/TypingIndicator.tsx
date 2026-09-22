import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Card, radius, useTheme } from "@/ui";

const DOT_COUNT = 3;
const BREATH_MS = 1500;

function Dot({ index }: { index: number }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withDelay(
      index * 160,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: BREATH_MS / 2, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.25, { duration: BREATH_MS / 2, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [index, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.ink },
        style,
      ]}
    />
  );
}

/** Thinking dots — bounded to the pending turn, not an ambient loop. */
export function TypingIndicator() {
  return (
    <View style={{ alignItems: "flex-start" }}>
      <Card rounded="md" style={{ borderBottomLeftRadius: radius.sm / 2 }}>
        <View style={{ flexDirection: "row", gap: 6, paddingVertical: 2 }}>
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <Dot key={i} index={i} />
          ))}
        </View>
      </Card>
    </View>
  );
}
