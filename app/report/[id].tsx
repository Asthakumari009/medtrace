import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Platform, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { ReportReader } from "@/components/health/ReportReader";
import { ShareSheet } from "@/components/ShareSheet";
import { useReportDetail } from "@/hooks/useReportDetail";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Button, Screen, Skeleton, Text } from "@/ui";
import { IconButton } from "@/components/health/Primitives";
export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const detail = useReportDetail(id ?? "");
  const [sharing, setSharing] = useState(false);
  if (!isLoading && !session) return <Redirect href="/(auth)/welcome" />;
  const openOriginal = async () => {
    // A report read on-device kept no file, so there is no original to open.
    const path = detail.report?.file_path;
    if (!path) return;
    const tab =
      Platform.OS === "web" ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;
    try {
      const { data, error } = await supabase.storage
        .from("reports")
        .createSignedUrl(path, 60);
      if (error)
        throw new Error("The original could not be opened. Please try again.");
      if (Platform.OS === "web") {
        if (!tab)
          throw new Error(
            "Allow this tab to open the original, then try again.",
          );
        tab.location.replace(data.signedUrl);
      } else await Linking.openURL(data.signedUrl);
    } catch (e) {
      tab?.close();
      throw e;
    }
  };
  return (
    <>
      <Screen scroll animated={false}>
        <View style={{ marginBottom: 20 }}>
          <IconButton
            icon={ChevronLeft}
            label="Back to documents"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/records")
            }
          />
        </View>
        {detail.error ? (
          <View style={{ gap: 18 }}>
            <Text variant="heading">Report unavailable</Text>
            <Text tone="soft">{detail.error}</Text>
            <Button title="Try again" onPress={() => void detail.refresh()} />
          </View>
        ) : !detail.report ? (
          <View style={{ gap: 18 }}>
            <Skeleton height={56} width="75%" />
            <Skeleton height={130} />
            <Skeleton height={230} />
          </View>
        ) : (
          <ReportReader
            key={detail.report.id}
            report={detail.report}
            summary={detail.event?.summary}
            observations={detail.observations}
            history={detail.history}
            historyError={detail.historyError}
            onOriginal={
              detail.report.file_path === null ? undefined : openOriginal
            }
            onShare={() => setSharing(true)}
            onEarlier={(reportId) =>
              router.push({
                pathname: "/report/[id]",
                params: { id: reportId },
              })
            }
          />
        )}
      </Screen>
      <ShareSheet
        key={`${session?.user.id}:${id}`}
        visible={sharing}
        onClose={() => setSharing(false)}
        initialReportId={id}
      />
    </>
  );
}
