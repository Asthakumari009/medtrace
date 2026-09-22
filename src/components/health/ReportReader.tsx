import { useMemo, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  Search,
  X,
} from "lucide-react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import type { ObservationRow, ReportRow } from "@/lib/database.types";
import {
  comparableReadings,
  exactNumeric,
  printedRange,
  testGuide,
} from "@/lib/reportInsights";
import {
  Button,
  Input,
  PressableScale,
  RangeBar,
  tabularNums,
  Text,
  useTheme,
} from "@/ui";
import { Tag, healthStyles as s } from "./Primitives";

export function ReportReader({
  report,
  summary,
  observations,
  history,
  demo = false,
  onOriginal,
  onShare,
  onEarlier,
  historyError,
}: {
  report: ReportRow;
  summary?: string | null;
  observations: ObservationRow[];
  history: ObservationRow[];
  demo?: boolean;
  onOriginal?: () => Promise<void>;
  onShare?: () => void;
  onEarlier?: (id: string) => void;
  historyError?: string | null;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All tests");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [limit, setLimit] = useState(50);
  const [originalBusy, setOriginalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categories = useMemo(
    () => ["All tests", ...new Set(observations.map((o) => o.category))],
    [observations],
  );
  const flagged = observations.filter((o) => o.flagged).length;
  const filtered = useMemo(
    () =>
      observations
        .filter(
          (o) =>
            (!flaggedOnly || o.flagged) &&
            (category === "All tests" || o.category === category) &&
            `${o.test_name} ${o.category}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(b.flagged) - Number(a.flagged) ||
            a.category.localeCompare(b.category),
        ),
    [observations, flaggedOnly, category, query],
  );
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 13 }}>
        <Tag
          label={
            demo ? "Illustrative sample record" : "Extracted from your report"
          }
        />
        <Text variant="title">{report.title}</Text>
        <Text variant="caption" tone="soft">
          {report.report_date ?? "Report date not recorded"} ·{" "}
          {report.file_path === null
            ? "Read on your phone · no copy stored"
            : `${report.file_type.toUpperCase()} source`}
        </Text>
        <View
          style={{
            flexDirection: "row",
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.hairline,
            paddingVertical: 18,
            marginTop: 2,
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="title" style={tabularNums}>
              {observations.length}
            </Text>
            <Text variant="eyebrow" tone="soft">
              Recorded values
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              variant="title"
              tone={flagged ? "alert" : "ink"}
              style={tabularNums}
            >
              {flagged}
            </Text>
            <Text variant="eyebrow" tone="soft">
              Flagged for review
            </Text>
          </View>
        </View>
      </View>
      {summary && (
        <View style={{ gap: 8 }}>
          <Text variant="label">At a glance</Text>
          <Text variant="label" tone="soft" style={{ lineHeight: 24 }}>
            {summary}
          </Text>
        </View>
      )}
      <View style={[s.panel, { backgroundColor: colors.accentSoft, gap: 13 }]}>
        <View style={[s.row, { gap: 9 }]}>
          <FileText size={19} color={colors.accentInk} />
          <Text variant="label" style={{ flex: 1 }}>
            The original is your source of truth
          </Text>
        </View>
        <Text variant="caption" tone="soft">
          Extracted values and flags may contain errors. Check the original
          before using them for care. A flag is not a diagnosis; an unflagged
          result does not rule out a health problem.
        </Text>
        {onOriginal && (
          <Button
            title="Open original report"
            variant="secondary"
            loading={originalBusy}
            onPress={() => {
              setOriginalBusy(true);
              setError(null);
              void onOriginal()
                .catch((e) => setError(e.message))
                .finally(() => setOriginalBusy(false));
            }}
          />
        )}
        {demo && (
          <Text variant="caption" tone="soft">
            This is synthetic data. No patient document is attached.
          </Text>
        )}
        {error && (
          <Text accessibilityRole="alert" variant="caption" tone="alert">
            {error}
          </Text>
        )}
      </View>
      {onShare && (
        <Button
          title="Choose access for this report"
          variant="secondary"
          onPress={onShare}
        />
      )}
      <View style={{ gap: 13 }}>
        <Text variant="heading">Understand your results</Text>
        <Input
          accessibilityLabel="Search tests in report"
          placeholder="Find a test or category"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setLimit(50);
          }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7 }}
        >
          {categories.map((c) => (
            <PressableScale
              key={c}
              accessibilityState={{ selected: c === category }}
              onPress={() => {
                setCategory(c);
                setLimit(50);
              }}
              style={{
                paddingHorizontal: 14,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: c === category ? colors.ink : colors.surface,
              }}
            >
              <Text
                variant="caption"
                style={{ color: c === category ? colors.bg : colors.inkSoft }}
              >
                {c}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
        <PressableScale
          accessibilityRole="checkbox"
          accessibilityLabel="Show only flagged values"
          accessibilityState={{ checked: flaggedOnly }}
          onPress={() => setFlaggedOnly((v) => !v)}
          style={[s.row, { gap: 9 }]}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: colors.inkSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {flaggedOnly && <Check size={16} color={colors.ink} />}
          </View>
          <Text variant="caption">Only flagged values</Text>
          <Text variant="caption" tone="soft">
            · {filtered.length} shown
          </Text>
        </PressableScale>
      </View>
      {historyError && (
        <Text variant="caption" tone="alert">
          {historyError} Current results remain available.
        </Text>
      )}
      <View style={{ gap: 12 }}>
        {filtered.slice(0, limit).map((o) => (
          <ObservationCard
            key={o.id}
            observation={o}
            history={history}
            onEarlier={onEarlier}
          />
        ))}
        {!filtered.length && (
          <View style={{ paddingVertical: 22, gap: 10 }}>
            <Text variant="label">
              {observations.length
                ? "No matching tests"
                : "No values were extracted"}
            </Text>
            <Text variant="caption" tone="soft">
              {observations.length
                ? "Change your search or filters to see more results."
                : "Open the source report to review its contents."}
            </Text>
          </View>
        )}
        {filtered.length > limit && (
          <Button
            title="Show more results"
            variant="secondary"
            onPress={() => setLimit((v) => v + 50)}
          />
        )}
      </View>
      <Text variant="caption" tone="soft">
        Comparisons use available earlier results from your 30 most recent
        processed reports, matching the test name, category, and unit. Different
        labs or methods can still affect comparability. Higher or lower does not
        automatically mean better or worse.
      </Text>
    </View>
  );
}
function ObservationCard({
  observation: o,
  history,
  onEarlier,
}: {
  observation: ObservationRow;
  history: ObservationRow[];
  onEarlier?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const value = exactNumeric(o),
    range = printedRange(o.reference_range);
  const previous = useMemo(() => comparableReadings(o, history), [o, history]);
  const last = previous.at(-1);
  const guide = testGuide(o.test_name);
  const delta = last && value !== null ? value - exactNumeric(last)! : null;
  return (
    <View style={[s.panel, { backgroundColor: colors.surface, gap: 12 }]}>
      <Text variant="caption" tone="soft">
        {o.category}
      </Text>
      <View style={[s.row, { alignItems: "flex-start", gap: 12 }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="heading" style={{ fontSize: 18 }}>
            {o.test_name}
          </Text>
          {o.flagged && (
            <Tag
              label="Flagged · review"
              color={colors.alert}
              fill={colors.alertSoft}
            />
          )}
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
          <Text
            selectable
            variant="title"
            tone={o.flagged ? "alert" : "ink"}
            style={tabularNums}
          >
            {o.value}
          </Text>
          <Text variant="caption" tone="soft">
            {o.unit ?? "Unit not provided"}
          </Text>
        </View>
      </View>
      <Text selectable variant="caption" tone="soft">
        Lab reference: {o.reference_range ?? "Not provided"}
      </Text>
      {range && value !== null && (
        <RangeBar
          value={value}
          low={range.low}
          high={range.high}
          flagged={o.flagged}
        />
      )}
      <Text variant="caption" tone="soft">
        Measured {o.observed_at ?? "on an unrecorded date"}
        {delta !== null
          ? ` · ${delta === 0 ? "Unchanged" : `${delta > 0 ? "+" : ""}${Number(delta.toPrecision(3))} ${o.unit}`} since ${last!.observed_at}`
          : ""}
      </Text>
      <PressableScale
        accessibilityLabel={`Details for ${o.test_name}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        style={[s.row, { justifyContent: "space-between" }]}
      >
        <Text variant="caption" tone="accent">
          {expanded ? "Less detail" : "Context & history"}
        </Text>
        <ChevronDown
          size={16}
          color={colors.ink}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      </PressableScale>
      {expanded && (
        <View
          style={{
            gap: 14,
            paddingTop: 8,
            borderTopWidth: 1,
            borderColor: colors.hairline,
          }}
        >
          {guide && (
            <>
              <Text variant="caption" tone="soft">
                {guide.body}
              </Text>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Read MedlinePlus about ${o.test_name}`}
                onPress={() => {
                  void Linking.openURL(guide.url).catch(() =>
                    setLinkError(true),
                  );
                }}
                style={[s.row, { gap: 6 }]}
              >
                <Text variant="caption" tone="accent">
                  Read the MedlinePlus explanation
                </Text>
                <ArrowUpRight size={14} color={colors.ink} />
              </PressableScale>
              {linkError && (
                <Text variant="caption" tone="alert">
                  The source page could not open. Please try again.
                </Text>
              )}
            </>
          )}
          {last && value !== null ? (
            <>
              <Text variant="label">Earlier comparable readings</Text>
              <HistoryLine rows={[...previous, o]} />
              {[...previous, o].map((row) => (
                <View
                  key={row.id}
                  style={[s.row, { justifyContent: "space-between", gap: 8 }]}
                >
                  <Text variant="caption" tone="soft">
                    {row.observed_at}
                  </Text>
                  <Text variant="label">
                    {row.value} {row.unit}
                  </Text>
                </View>
              ))}
              {onEarlier && (
                <Button
                  title="Open previous report"
                  size="sm"
                  variant="ghost"
                  onPress={() => onEarlier(last.report_id)}
                />
              )}
            </>
          ) : (
            <Text variant="caption" tone="soft">
              No unambiguous earlier numeric result with the same test name,
              category, and unit is available.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
function HistoryLine({ rows }: { rows: ObservationRow[] }) {
  const { colors } = useTheme();
  const values = rows.map((r) => exactNumeric(r)!);
  const min = Math.min(...values),
    span = Math.max(...values) - min || 1;
  const dates = rows.map((r) => Date.parse(r.observed_at!));
  const start = dates[0]!,
    duration = dates.at(-1)! - start || 1;
  const points = values.map((v, i) => ({
    x: 8 + ((dates[i]! - start) / duration) * 280,
    y: 65 - ((v - min) / span) * 50,
  }));
  return (
    <Svg
      height={85}
      width="100%"
      viewBox="0 0 296 85"
      accessibilityElementsHidden
    >
      <Polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={colors.ink}
        strokeWidth={2}
      />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colors.ink} />
      ))}
    </Svg>
  );
}
