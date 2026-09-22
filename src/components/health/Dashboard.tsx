import {
  ArrowUpRight,
  FileText,
  MessageSquare,
  Plus,
  QrCode,
  ScanLine,
  TriangleAlert,
} from "lucide-react-native";
import { RefreshControl, View } from "react-native";

import { currentLocale } from "@/i18n";
import {
  Card,
  PressableScale,
  radius,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from "@/ui";

import { useExperience } from "./Experience";
import {
  ActionLink,
  Brand,
  healthStyles as s,
  IconButton,
  SectionTitle,
  Stat,
  Tag,
} from "./Primitives";

function shortDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Home: the identity panel, the two counts that matter, and the newest
 * document. Everything else lives one tap away in Records.
 */
export function Dashboard() {
  const exp = useExperience();
  const { colors } = useTheme();
  const latest = exp.events[0];

  return (
    <Screen
      tabbed
      scroll
      animated={false}
      refreshControl={
        <RefreshControl
          refreshing={exp.refreshing}
          onRefresh={() => void exp.refresh()}
          tintColor={colors.inkSoft}
        />
      }
    >
      <View style={[s.between, { marginBottom: 26 }]}>
        <Brand />
        <View style={[s.row, { gap: 8 }]}>
          <IconButton
            icon={QrCode}
            label="Share records with a doctor"
            onPress={() => exp.action("share")}
          />
          <IconButton
            emphasis
            icon={Plus}
            label="Add a medical report"
            onPress={() => exp.action("add")}
          />
        </View>
      </View>

      {/* The identity panel — one inverted card per screen. */}
      <Card variant="invert" rounded="lg" style={{ padding: 22 }}>
        <Text variant="eyebrow" tone="onSurfaceHiSoft">
          Health record
        </Text>
        <Text
          variant="title"
          tone="onSurfaceHi"
          numberOfLines={2}
          style={{ marginTop: 6 }}
        >
          {exp.name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: 28,
            marginTop: 22,
            paddingTop: 18,
            borderTopWidth: 1,
            borderTopColor: colors.onSurfaceHiFaint,
          }}
        >
          <Stat
            label="Documents"
            value={String(exp.totals.documents)}
            tone="onSurfaceHi"
          />
          <Stat
            label="Values read"
            value={String(exp.totals.values)}
            tone="onSurfaceHi"
          />
        </View>
      </Card>

      {/* The one lime element on the screen, paired with a neutral tile. */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <PressableScale
          accessibilityLabel={`All documents, ${exp.totals.documents}`}
          onPress={() => exp.goTo("records")}
          style={{
            flex: 1,
            backgroundColor: colors.accent,
            borderRadius: radius.lg,
            padding: 18,
            minHeight: 116,
            justifyContent: "space-between",
          }}
        >
          <View style={s.between}>
            <Text variant="eyebrow" tone="onAccent">
              Documents
            </Text>
            <ArrowUpRight size={18} color={colors.onAccent} strokeWidth={2} />
          </View>
          <Text variant="metric" tone="onAccent">
            {exp.totals.documents}
          </Text>
        </PressableScale>

        <PressableScale
          accessibilityLabel={`Flagged values, ${exp.totals.flagged}`}
          onPress={() => exp.goTo("records")}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: radius.lg,
            padding: 18,
            minHeight: 116,
            justifyContent: "space-between",
          }}
        >
          <View style={s.between}>
            <Text variant="eyebrow" tone="soft">
              Flagged
            </Text>
            {exp.totals.flagged > 0 ? (
              <TriangleAlert size={18} color={colors.alert} strokeWidth={2} />
            ) : (
              <ArrowUpRight size={18} color={colors.inkSoft} strokeWidth={2} />
            )}
          </View>
          <Text
            variant="metric"
            tone={exp.totals.flagged > 0 ? "alert" : "ink"}
          >
            {exp.totals.flagged}
          </Text>
        </PressableScale>
      </View>

      {exp.error !== null && (
        <Text
          accessibilityRole="alert"
          variant="caption"
          tone="alert"
          style={{ marginTop: 16 }}
        >
          Your records could not refresh. Pull down to try again.
        </Text>
      )}

      <SectionTitle
        title="Latest"
        action={exp.totals.documents > 0 ? "All documents" : undefined}
        onPress={() => exp.goTo("records")}
      />

      {exp.loading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={86} rounded="lg" />
          <Skeleton height={86} rounded="lg" />
        </View>
      ) : latest !== undefined ? (
        <PressableScale
          accessibilityLabel={`Open ${latest.title}`}
          onPress={() => exp.openReport(latest)}
          style={[
            s.panel,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.hairline,
            },
          ]}
        >
          <View style={[s.row, { gap: 13, alignItems: "flex-start" }]}>
            <View
              style={{
                padding: 11,
                borderRadius: radius.sm,
                backgroundColor: colors.fill,
              }}
            >
              <FileText size={20} color={colors.ink} strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label" numberOfLines={1}>
                {latest.title}
              </Text>
              <Text variant="caption" tone="soft">
                {shortDate(latest.occurred_at)} ·{" "}
                {exp.stats[latest.report_id ?? ""]?.count ?? 0} values
              </Text>
            </View>
            <ArrowUpRight size={18} color={colors.inkSoft} strokeWidth={1.7} />
          </View>
          {(exp.stats[latest.report_id ?? ""]?.flagged ?? 0) > 0 && (
            <View style={{ marginTop: 13 }}>
              <Tag
                label={`${exp.stats[latest.report_id ?? ""]!.flagged} flagged by the lab`}
                color={colors.alert}
                fill={colors.alertSoft}
              />
            </View>
          )}
        </PressableScale>
      ) : (
        <Card rounded="lg" style={{ padding: 22, gap: 14 }}>
          <ScanLine size={26} color={colors.ink} strokeWidth={1.5} />
          <Text variant="heading">Add your first report</Text>
          <Text variant="caption" tone="soft" style={{ lineHeight: 19 }}>
            Photograph a lab report and MedTrace reads it on this phone. Only
            the extracted text is sent for structuring — the photo stays here.
          </Text>
        </Card>
      )}

      <View
        style={{
          marginTop: 18,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
        }}
      >
        <ActionLink
          title="Ask about your records"
          subtitle="Answers cite the reports they came from"
          icon={MessageSquare}
          onPress={() => exp.goTo("chat")}
        />
        <View style={{ height: 1, backgroundColor: colors.hairline }} />
        <ActionLink
          title="Share with a doctor"
          subtitle="One-time link, expires in 30 minutes"
          icon={QrCode}
          onPress={() => exp.action("share")}
        />
      </View>
    </Screen>
  );
}
