import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { useTheme } from "./ThemeContext";

/**
 * The app icon, drawn live: a vital-sign trace whose spike reads as an M,
 * ending in one point. Same geometry as scripts/render-brand.cjs.
 *
 * The tile is always dark so the lime stroke keeps its contrast: the
 * inverted panel on the light canvas, a raised surface on the dark one.
 */
export function BrandMark({ size = 64 }: { size?: number }) {
  const { colors, scheme } = useTheme();
  return (
    // Decorative: the accessible name is on the screen's text. The hiding
    // props live on a View because react-native-svg forwards them to the DOM.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Rect
          width={1024}
          height={1024}
          rx={232}
          fill={scheme === "dark" ? colors.surface : colors.surfaceHi}
        />
        <Path
          d="M168 572 H310 L416 318 L512 648 L608 318 L714 572 H742"
          transform="translate(512 512) scale(0.8) translate(-512 -498)"
          fill="none"
          stroke={colors.accent}
          strokeWidth={68}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle
          cx={850}
          cy={572}
          r={44}
          transform="translate(512 512) scale(0.8) translate(-512 -498)"
          fill={colors.accent}
        />
      </Svg>
    </View>
  );
}
