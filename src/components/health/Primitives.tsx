import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react-native";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { PressableScale, radius, Text, useTheme } from "@/ui";

export const healthStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  panel: { borderRadius: radius.lg, padding: 18 },
  section: { marginTop: 24, marginBottom: 12 },
});

/** The wordmark: MED in ink, TRACE in the lime-safe accent ink. */
export function Brand({ small = false }: { small?: boolean }) {
  const { colors } = useTheme();
  const size = small ? 19 : 24;
  return (
    <View style={healthStyles.row} accessibilityLabel="MedTrace">
      <Text
        style={{
          fontSize: size,
          lineHeight: size + 4,
          letterSpacing: -0.8,
          fontFamily: "Geist_600SemiBold",
          color: colors.ink,
        }}
      >
        Med
      </Text>
      <Text
        style={{
          fontSize: size,
          lineHeight: size + 4,
          letterSpacing: -0.8,
          fontFamily: "Geist_600SemiBold",
          color: colors.accentInk,
        }}
      >
        Trace
      </Text>
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[healthStyles.between, healthStyles.section]}>
      <Text variant="heading" style={{ flex: 1 }}>
        {title}
      </Text>
      {action && (
        <PressableScale
          onPress={onPress}
          accessibilityLabel={`${action}: ${title}`}
          style={[healthStyles.row, { gap: 3, maxWidth: "40%" }]}
        >
          <Text variant="caption" tone="soft" style={{ flexShrink: 1 }}>
            {action}
          </Text>
          <ChevronRight size={14} color={colors.inkSoft} />
        </PressableScale>
      )}
    </View>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  style,
  emphasis = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  /** The one lime circle — use for the primary action in a header. */
  emphasis?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: radius.pill,
          backgroundColor: emphasis ? colors.accent : colors.fill,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Icon
        size={20}
        color={emphasis ? colors.onAccent : colors.ink}
        strokeWidth={1.7}
      />
    </PressableScale>
  );
}

export function Tag({
  label,
  color,
  fill,
}: {
  label: string;
  color?: string;
  fill?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: radius.pill,
        backgroundColor: fill ?? colors.fill,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text variant="caption" style={{ color: color ?? colors.inkSoft }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The reference layout's signature block: a micro-label above a large
 * tabular number. Used for every count the user reads as data.
 */
export function Stat({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "onAccent" | "onSurfaceHi";
}) {
  const soft =
    tone === "onAccent"
      ? "onAccent"
      : tone === "onSurfaceHi"
        ? "onSurfaceHiSoft"
        : "soft";
  return (
    <View style={{ gap: 2 }}>
      <Text variant="eyebrow" tone={soft} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="title" tone={tone} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

export function ActionLink({
  title,
  subtitle,
  onPress,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  icon: LucideIcon;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={title}
      onPress={onPress}
      style={[healthStyles.row, { gap: 13, paddingVertical: 15 }]}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.sm,
          backgroundColor: colors.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={colors.ink} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="label">{title}</Text>
        <Text variant="caption" tone="soft">
          {subtitle}
        </Text>
      </View>
      <ArrowUpRight size={18} color={colors.inkSoft} strokeWidth={1.7} />
    </PressableScale>
  );
}
