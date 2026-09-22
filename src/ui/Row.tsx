import { ChevronRight } from "lucide-react-native";
import { View } from "react-native";

import { PressableScale } from "./PressableScale";
import { Text } from "./Text";
import { useTheme } from "./ThemeContext";

export interface RowProps {
  /** 18pt lucide icon, ink on a neutral fill disc. */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Right-aligned slot (spinner, value, badge). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  /** Defaults to true when pressable. */
  chevron?: boolean;
  accessibilityLabel?: string;
}

/**
 * One row in a grouped settings card: icon disc, title over subtitle,
 * trailing slot, chevron when it navigates. Stack inside a Card
 * (padded={false}) with hairline separators between rows.
 */
export function Row({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
  chevron = onPress !== undefined,
  accessibilityLabel,
}: RowProps) {
  const { colors } = useTheme();

  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
      }}
    >
      {icon !== undefined && (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.fill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        {subtitle !== undefined && (
          <Text variant="caption" tone="soft">
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {chevron && <ChevronRight size={18} strokeWidth={1.5} color={colors.inkFaint} />}
    </View>
  );

  if (onPress === undefined) return content;

  return (
    <PressableScale accessibilityLabel={accessibilityLabel ?? title} onPress={onPress}>
      {content}
    </PressableScale>
  );
}
