import { type ComponentProps } from "react";
import { type Tabs } from "expo-router";
import {
  FileText,
  House,
  MessageSquare,
  UserRound,
} from "lucide-react-native";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  liftShadow,
  PressableScale,
  radius,
  scaledTabBarHeight,
  TAB_BAR_OFFSET,
  Text,
  useTheme,
} from "@/ui";

import type { Destination } from "./health/Experience";

const ITEMS = [
  { key: "home", route: "index", label: "Home", icon: House },
  { key: "records", route: "records", label: "Documents", icon: FileText },
  { key: "chat", route: "chat", label: "Ask", icon: MessageSquare },
  { key: "profile", route: "profile", label: "You", icon: UserRound },
] as const;

/**
 * Floating pill bar. The active tab is a solid lime chip with near-black
 * glyph and label — the one loud element, and the same accent the primary
 * action uses everywhere else.
 */
export function BottomNavigation({
  selected,
  onNavigate,
}: {
  selected: Destination;
  onNavigate: (destination: Destination) => void;
}) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { colors } = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: Math.max(16, insets.left),
        right: Math.max(16, insets.right),
        bottom: insets.bottom + TAB_BAR_OFFSET,
        alignItems: "center",
      }}
    >
      <View
        style={[
          {
            width: "100%",
            maxWidth: 480,
            minHeight: scaledTabBarHeight(fontScale),
            paddingVertical: 7,
            paddingHorizontal: 7,
            backgroundColor: colors.surfaceHi,
            borderRadius: radius.pill,
            flexDirection: "row",
            alignItems: "center",
          },
          liftShadow,
        ]}
      >
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const active = key === selected;
          return (
            <PressableScale
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              onPress={() => onNavigate(key)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                minHeight: 48,
                borderRadius: radius.pill,
                backgroundColor: active ? colors.accent : "transparent",
              }}
            >
              <Icon
                size={19}
                strokeWidth={active ? 2.1 : 1.7}
                color={active ? colors.onAccent : colors.onSurfaceHiSoft}
              />
              <Text
                variant="eyebrow"
                numberOfLines={1}
                style={{
                  fontSize: 9,
                  letterSpacing: 0.6,
                  lineHeight: 12,
                  color: active ? colors.onAccent : colors.onSurfaceHiSoft,
                }}
              >
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

export function TabBar({ state, navigation }: TabBarProps) {
  const focused = state.routes[state.index]?.name;
  return (
    <BottomNavigation
      selected={ITEMS.find((i) => i.route === focused)?.key ?? "home"}
      onNavigate={(destination) => {
        const target = ITEMS.find((i) => i.key === destination)!;
        const route = state.routes.find((r) => r.name === target.route);
        if (!route) return;
        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented && focused !== route.name)
          navigation.navigate(route.name);
      }}
    />
  );
}
