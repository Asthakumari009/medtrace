import {
  ArrowUpRight,
  FileText,
  Plus,
  QrCode,
  Search,
  X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";

import { ReportCard } from "@/components/ReportCard";
import { currentLocale } from "@/i18n";
import type { TimelineEventRow } from "@/lib/database.types";
import {
  Button,
  Input,
  PressableScale,
  radius,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from "@/ui";

import { useExperience } from "./Experience";
import { healthStyles as s, IconButton, Tag } from "./Primitives";

const FILTERS = ["All", "Flagged"] as const;

export function Records() {
  const exp = useExperience();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const rows = useMemo(
    () =>
      exp.events.filter((e) => {
        if (filter === "Flagged" && !(exp.stats[e.report_id ?? ""]?.flagged ?? 0))
          return false;
        // Searching a drug or a condition is how people actually look for a
        // document ("that antibiotic"), so the haystack is not just the title.
        const detail = exp.clinical[e.report_id ?? ""];
        const haystack = [
          e.title,
          e.summary ?? "",
          e.occurred_at,
          detail?.doctor_name ?? "",
          detail?.facility_name ?? "",
          ...(detail?.diagnoses ?? []),
          ...(detail?.medications ?? []).map((m) => m.name),
        ].join(" ");
        return haystack.toLowerCase().includes(query.trim().toLowerCase());
      }),
    [exp.events, exp.stats, exp.clinical, filter, query],
  );

  return (
    <Screen tabbed animated={false}>
      {/* FlatList, not FlashList: filtered rows can disappear mid-layout and
          the recycler processed stale size callbacks. At a few dozen
          documents the windowed FlatList is already well inside budget. */}
      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshing={exp.refreshing}
        onRefresh={() => void exp.refresh()}
        ListHeaderComponent={
          <>
            <View style={[s.between, { marginBottom: 20 }]}>
              <Text variant="title">Documents</Text>
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

            <View
              style={[
                s.row,
                {
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  borderRadius: radius.pill,
                  paddingLeft: 16,
                  paddingRight: 4,
                  marginBottom: 12,
                },
              ]}
            >
              <Search size={18} color={colors.inkSoft} />
              <Input
                accessibilityLabel="Search health records"
                value={query}
                onChangeText={setQuery}
                placeholder="Search documents or dates"
                style={{
                  flex: 1,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                }}
              />
              {query !== "" && (
                <IconButton
                  icon={X}
                  label="Clear search"
                  onPress={() => setQuery("")}
                />
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
              {FILTERS.map((f) => {
                const active = f === filter;
                return (
                  <PressableScale
                    key={f}
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(f)}
                    style={{
                      paddingHorizontal: 16,
                      minHeight: 36,
                      justifyContent: "center",
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: active ? colors.ink : colors.hairline,
                      backgroundColor: active ? colors.ink : "transparent",
                    }}
                  >
                    <Text
                      variant="caption"
                      style={{ color: active ? colors.bg : colors.inkSoft }}
                    >
                      {f}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>

            {exp.error !== null && (
              <View style={{ gap: 12, marginBottom: 14 }}>
                <Text variant="caption" tone="alert" accessibilityRole="alert">
                  Your records could not refresh.
                </Text>
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => void exp.refresh()}
                />
              </View>
            )}

            <View style={{ gap: 10 }}>
              {exp.pending
                .filter((p) =>
                  p.title.toLowerCase().includes(query.toLowerCase()),
                )
                .map((p) => (
                  <ReportCard
                    key={p.id}
                    report={p}
                    observationCount={0}
                    onChanged={() => void exp.refresh()}
                  />
                ))}
              <View style={[s.between, { marginBottom: 4 }]}>
                <Text variant="eyebrow" tone="soft">
                  {exp.loading
                    ? "Loading"
                    : `${rows.length} ${rows.length === 1 ? "document" : "documents"}`}
                </Text>
                <Text variant="eyebrow" tone="soft">
                  Newest first
                </Text>
              </View>
            </View>
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          exp.loading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={100} rounded="lg" />
              <Skeleton height={100} rounded="lg" />
            </View>
          ) : (
            <View
              style={{
                alignItems: "center",
                paddingVertical: 34,
                paddingHorizontal: 12,
                gap: 14,
              }}
            >
              <FileText size={32} color={colors.ink} strokeWidth={1.4} />
              <Text variant="heading">
                {query || filter !== "All"
                  ? "No matching documents"
                  : "No documents yet"}
              </Text>
              <Text
                variant="caption"
                tone="soft"
                style={{ textAlign: "center", lineHeight: 20 }}
              >
                {query || filter !== "All"
                  ? "Try a different search or show all documents."
                  : "Add a lab report to keep its values and its original source together."}
              </Text>
              <Button
                title={
                  query || filter !== "All" ? "Reset filters" : "Add a report"
                }
                variant="secondary"
                onPress={() => {
                  if (query || filter !== "All") {
                    setQuery("");
                    setFilter("All");
                  } else exp.action("add");
                }}
              />
            </View>
          )
        }
        renderItem={({ item }: { item: TimelineEventRow }) => {
          const count = exp.stats[item.report_id ?? ""];
          return (
            <PressableScale
              onPress={() => exp.openReport(item)}
              accessibilityLabel={`Open ${item.title}`}
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
                    {item.title}
                  </Text>
                  <Text variant="caption" tone="soft">
                    {new Date(
                      `${item.occurred_at}T12:00:00`,
                    ).toLocaleDateString(currentLocale(), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {count?.count ?? 0} values
                  </Text>
                </View>
                <ArrowUpRight
                  size={17}
                  color={colors.inkSoft}
                  strokeWidth={1.7}
                />
              </View>
              {item.summary && (
                <Text
                  variant="caption"
                  tone="soft"
                  numberOfLines={2}
                  style={{ marginTop: 12, lineHeight: 19 }}
                >
                  {item.summary}
                </Text>
              )}
              {(count?.flagged ?? 0) > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Tag
                    label={`${count!.flagged} flagged by the lab · review with your clinician`}
                    color={colors.alert}
                    fill={colors.alertSoft}
                  />
                </View>
              )}
            </PressableScale>
          );
        }}
      />
    </Screen>
  );
}
