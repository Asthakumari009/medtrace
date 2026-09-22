import {
  FileText,
  Image as ImageIcon,
  RefreshCw,
  ScanLine,
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { currentLocale } from "@/i18n";
import { type ReportRow } from "@/lib/database.types";
import { requestExtraction } from "@/lib/reports";
import { Card, PressableScale, Skeleton, Text, useTheme } from "@/ui";

export interface ReportCardProps {
  report: ReportRow;
  observationCount: number;
  onChanged: () => void;
}

function formatDate(iso: string | null, fallback: string): string {
  if (iso === null) return fallback;
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ReportCard({ report, observationCount, onChanged }: ReportCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  // A report read on this device kept no file, so there is nothing to retry
  // against — the user has to photograph it again.
  const onDevice = report.extraction_source === "on_device_ocr";
  const Icon = onDevice
    ? ScanLine
    : report.file_type === "pdf"
      ? FileText
      : ImageIcon;
  const isWorking = report.status === "processing";
  const isFailed = report.status === "failed";
  const isQueued = report.status === "uploaded";
  const canRetry = (isFailed || isQueued) && !onDevice;

  const retry = async (): Promise<void> => {
    setRetrying(true);
    try {
      await requestExtraction(report.id);
    } catch {
      // Stays failed/queued; user can retry again.
    } finally {
      setRetrying(false);
      onChanged();
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isFailed ? colors.alertSoft : colors.fill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} strokeWidth={1.5} color={isFailed ? colors.alert : colors.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={1}>
            {report.title}
          </Text>
          {report.status === "processed" && (
            <Text variant="caption" tone="soft">
              {t("reportCard.processedMeta", {
                count: observationCount,
                date: formatDate(report.report_date, t("common.dateUnknown")),
              })}
            </Text>
          )}
          {isWorking && (
            <Text variant="caption" tone="soft">
              {t("reportCard.reading")}
            </Text>
          )}
          {isQueued && (
            <Text variant="caption" tone="soft">
              {t("reportCard.queued")}
            </Text>
          )}
          {isFailed && (
            <Text variant="caption" tone="alert">
              {onDevice
                ? "Reading failed. Photograph the report again."
                : t("reportCard.failed")}
            </Text>
          )}
          {report.status === "processed" && onDevice && (
            <Text variant="caption" tone="accent">
              Read on your phone
            </Text>
          )}
        </View>
        {canRetry && (
          <PressableScale
            accessibilityLabel={t("reportCard.retryExtraction")}
            onPress={() => void retry()}
            disabled={retrying}
            style={{
              paddingHorizontal: 12,
              height: 44,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              opacity: retrying ? 0.4 : 1,
            }}
          >
            <RefreshCw size={16} strokeWidth={1.7} color={colors.accentInk} />
            <Text variant="caption" tone="accent">
              {t("common.retry")}
            </Text>
          </PressableScale>
        )}
      </View>
      {isWorking && (
        <View style={{ gap: 8, marginTop: 14 }}>
          <Skeleton width="82%" height={12} />
          <Skeleton width="64%" height={12} />
          <Skeleton width="73%" height={12} />
        </View>
      )}
    </Card>
  );
}
