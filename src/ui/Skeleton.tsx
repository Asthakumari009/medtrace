import { View, type DimensionValue } from "react-native";

import { radius } from "./theme";
import { useTheme } from "./ThemeContext";

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  rounded?: keyof typeof radius;
}

/**
 * Loading placeholder. Deliberately static: a list renders a dozen of these
 * at once, and a dozen infinite opacity loops keep the UI thread and GPU
 * awake for as long as the screen is open. The shape alone reads as loading.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  rounded = "sm",
}: SkeletonProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius: radius[rounded],
        backgroundColor: colors.fill,
      }}
    />
  );
}
