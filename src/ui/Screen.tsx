import {
  ScrollView,
  View,
  useWindowDimensions,
  type ScrollViewProps,
  type ViewProps,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { enterUp } from "./motion";
import { SCREEN_PADDING, scaledTabBarHeight, TAB_BAR_OFFSET } from "./theme";
import { useTheme } from "./ThemeContext";

export interface ScreenProps extends ViewProps {
  refreshControl?: ScrollViewProps["refreshControl"];
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Extra bottom padding so content clears the floating tab bar. */
  tabbed?: boolean;
  /** Disable the standard entrance animation (rarely). */
  animated?: boolean;
}

/** Content must end tab-bar height + 16 above the safe-area edge. */
export function Screen({
  scroll = false,
  tabbed = false,
  animated = true,
  style,
  children,
  ...rest
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const tabClearance = TAB_BAR_OFFSET + scaledTabBarHeight(fontScale) + 16;
  const { colors } = useTheme();

  const padding = {
    paddingTop: insets.top + 8,
    paddingBottom: tabbed ? insets.bottom + tabClearance : insets.bottom + 16,
    paddingLeft: Math.max(SCREEN_PADDING, insets.left),
    paddingRight: Math.max(SCREEN_PADDING, insets.right),
  };

  const body = animated ? (
    <Animated.View entering={enterUp()} style={{ flex: 1 }}>
      {children}
    </Animated.View>
  ) : (
    children
  );

  if (scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            padding,
            { flexGrow: 1, width: "100%", maxWidth: 1040, alignSelf: "center" },
            style,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...rest}
        >
          {body}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }]} {...rest}>
      <View
        style={[
          { flex: 1, width: "100%", maxWidth: 1040, alignSelf: "center" },
          padding,
          style,
        ]}
      >
        {body}
      </View>
    </View>
  );
}
