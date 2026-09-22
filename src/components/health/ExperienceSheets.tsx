import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { AddReportSheet } from "@/components/AddReportSheet";
import { ShareSheet } from "@/components/ShareSheet";
import type { TimelineEventRow } from "@/lib/database.types";
import { demoReport } from "@/lib/demo";
import { addReport, type ExtractionSource, type PickedFile } from "@/lib/reports";
import { Button, Sheet, Text } from "@/ui";

import { useExperience, type HealthAction } from "./ExperienceContext";
import { Tag } from "./Primitives";
import { ReportReader } from "./ReportReader";

type Upload =
  | { state: "busy" }
  | { state: "done"; source: ExtractionSource }
  | { state: "failed"; message: string }
  | null;

/** What the user is told about where their document was read. */
const SOURCE_COPY: Record<ExtractionSource, { title: string; body: string }> = {
  on_device_ocr: {
    title: "Read on your phone",
    body: "This report was read here on your device. Only the extracted text was sent to be structured — the photo never left the phone.",
  },
  cloud: {
    title: "Read in the cloud",
    body: "This file was uploaded and read in the cloud. PDFs and photos that are too dark or blurry to read on the phone take this path.",
  },
};

export function ExperienceSheets({
  action,
  onClose,
  report,
  closeReport,
}: {
  action: HealthAction;
  onClose: () => void;
  report: TimelineEventRow | null;
  closeReport: () => void;
}) {
  const exp = useExperience();
  const router = useRouter();
  const [upload, setUpload] = useState<Upload>(null);

  const sampleReport = useMemo(
    () => (exp.demo && report?.report_id ? demoReport(report.report_id) : null),
    [exp.demo, report?.report_id],
  );

  const picked = async (file: PickedFile) => {
    setUpload({ state: "busy" });
    try {
      const { source } = await addReport(file);
      await exp.refresh();
      setUpload({ state: "done", source });
    } catch (e) {
      setUpload({
        state: "failed",
        message:
          e instanceof Error ? e.message : "The report could not be added.",
      });
    }
  };

  return (
    <>
      {!exp.demo && (
        <AddReportSheet
          visible={action === "add"}
          onClose={onClose}
          onPicked={(file) => void picked(file)}
        />
      )}
      <ShareSheet
        visible={action === "share"}
        onClose={onClose}
        demo={exp.demo}
      />

      <Sheet
        visible={exp.demo && action === "add"}
        onClose={onClose}
        title="Make this space your own"
      >
        <View style={{ gap: 18 }}>
          <Tag label="You're exploring sample data" />
          <Text tone="soft">
            Create your private account to add reports and share records with
            your doctor.
          </Text>
          <Button
            title="Get started"
            onPress={() => {
              onClose();
              router.push("/(auth)/email");
            }}
          />
          <Button title="Keep exploring" variant="secondary" onPress={onClose} />
        </View>
      </Sheet>

      <Sheet
        visible={report !== null}
        onClose={closeReport}
        title={sampleReport ? "Report reader" : report?.title}
        closeLabel={sampleReport ? "Close report reader" : undefined}
      >
        {sampleReport ? (
          <>
            <ReportReader
              key={sampleReport.report.id}
              {...sampleReport}
              summary={report?.summary}
              demo
            />
            <Button
              title="Done"
              onPress={closeReport}
              style={{ marginTop: 22 }}
            />
          </>
        ) : (
          <View style={{ gap: 16 }}>
            <Tag label={exp.demo ? "Illustrative sample record" : "Your record"} />
            <Text variant="caption" tone="soft">
              {report?.occurred_at}
            </Text>
            <Text>{report?.summary ?? "No additional notes."}</Text>
            <Button title="Done" onPress={closeReport} />
          </View>
        )}
      </Sheet>

      <Sheet
        visible={upload !== null}
        onClose={() => {
          if (upload?.state !== "busy") setUpload(null);
        }}
        title={
          upload === null
            ? undefined
            : upload.state === "busy"
              ? "Reading your report…"
              : upload.state === "done"
                ? SOURCE_COPY[upload.source].title
                : "Couldn't add the report"
        }
      >
        <View style={{ gap: 16 }}>
          {upload?.state === "done" && (
            <Tag
              label={
                upload.source === "on_device_ocr"
                  ? "On-device · nothing uploaded"
                  : "Uploaded · read in the cloud"
              }
            />
          )}
          <Text variant="label" tone="soft" style={{ lineHeight: 21 }}>
            {upload === null
              ? ""
              : upload.state === "busy"
                ? "Reading the document and pulling out its values. Large reports may take a moment."
                : upload.state === "done"
                  ? SOURCE_COPY[upload.source].body
                  : upload.message}
          </Text>
          {upload?.state === "done" && (
            <Text variant="caption" tone="soft">
              Open the report to check the extracted values before using them
              for care decisions.
            </Text>
          )}
          {upload !== null && upload.state !== "busy" && (
            <Button
              title="View documents"
              onPress={() => {
                setUpload(null);
                exp.goTo("records");
              }}
            />
          )}
        </View>
      </Sheet>
    </>
  );
}
