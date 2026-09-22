import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { DUR, EASE_OUT, liftShadow, radius } from "./theme";
import { useTheme } from "./ThemeContext";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
  children: React.ReactNode;
}

const DISMISS_DRAG = 120;
const DISMISS_VELOCITY = 800;
const OFFSCREEN = 1200;

/**
 * Bottom sheet: slides up on the house curve and decelerates to rest — no
 * overshoot, and the app behind it does not scale (a full-tree transform per
 * frame bought nothing but a flourish). Drag-to-dismiss via gesture-handler.
 */
export function Sheet({
  visible,
  onClose,
  title,
  closeLabel,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(OFFSCREEN);
  const [mounted, setMounted] = useState(visible);
  const body = useRef<ScrollView>(null);

  useEffect(() => {
    const timing = { duration: DUR.base, easing: EASE_OUT };
    if (visible) {
      setMounted(true);
      opacity.value = withTiming(1, timing);
      translateY.value = withTiming(0, timing);
      return;
    }
    opacity.value = withTiming(0, timing);
    translateY.value = withTiming(OFFSCREEN, timing, (finished) => {
      if (finished === true) runOnJS(setMounted)(false);
    });
    // Safety net: if the UI thread is wedged (e.g. returning from a native
    // permission activity), the completion callback may never fire. Unmount
    // anyway so the full-screen backdrop can't trap the app.
    const fallback = setTimeout(() => setMounted(false), 600);
    return () => clearTimeout(fallback);
  }, [visible, opacity, translateY]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DRAG || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, {
          duration: DUR.base,
          easing: EASE_OUT,
        });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
      onShow={() => body.current?.scrollTo({ y: 0, animated: false })}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.scrim },
            backdropStyle,
          ]}
        >
          <Pressable
            accessibilityLabel={t("common.close")}
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
        </Animated.View>
        {/* Normal flex positioning lets keyboard padding move the whole panel. */}
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: "flex-end",
            alignItems: "center",
            paddingTop: insets.top + 12,
          }}
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              {
                width: "100%",
                maxWidth: 760,
                maxHeight: height - insets.top - 12,
                flexShrink: 1,
                backgroundColor: colors.bg,
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                borderTopWidth: 1,
                borderColor: colors.hairline,
                paddingHorizontal: Math.max(20, insets.left, insets.right),
                paddingBottom: insets.bottom + 20,
              },
              liftShadow,
              panelStyle,
            ]}
          >
            {/* Only the handle drags; scrolling a medical record must not dismiss it. */}
            <GestureDetector gesture={pan}>
              <View
                style={{
                  height: 32,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.hairline,
                  }}
                />
              </View>
            </GestureDetector>
            {title !== undefined && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <Text variant="heading" style={{ flex: 1 }}>
                  {title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel ?? t("common.close")}
                  onPress={onClose}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 25 }}>×</Text>
                </Pressable>
              </View>
            )}
            <ScrollView
              ref={body}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 2 }}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
