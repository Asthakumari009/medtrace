import { Camera, FileUp, Images, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useEffect, useRef, useState } from "react";

import {
  pickDocument,
  pickFromCamera,
  pickFromLibrary,
  type PickedFile,
} from "@/lib/reports";
import { onDeviceOcrAvailable } from "@/lib/ocr";
import { PressableScale, radius, Sheet, Text, useTheme } from "@/ui";

export interface AddReportSheetProps {
  visible: boolean;
  onClose: () => void;
  onPicked: (file: PickedFile) => void;
}

interface SourceOption {
  icon: LucideIcon;
  labelKey: string;
  hintKey: string;
  pick: () => Promise<PickedFile | null>;
}

const options: SourceOption[] = [
  {
    icon: Camera,
    labelKey: "addReport.camera",
    hintKey: "addReport.cameraHint",
    pick: pickFromCamera,
  },
  {
    icon: Images,
    labelKey: "addReport.library",
    hintKey: "addReport.libraryHint",
    pick: pickFromLibrary,
  },
  {
    icon: FileUp,
    labelKey: "addReport.files",
    hintKey: "addReport.filesHint",
    pick: pickDocument,
  },
];

export function AddReportSheet({
  visible,
  onClose,
  onPicked,
}: AddReportSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const onDevice = onDeviceOcrAvailable();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picking = useRef(false);
  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);
  const handle = async (option: SourceOption): Promise<void> => {
    if (picking.current) return;
    picking.current = true;
    setBusy(true);
    setError(null);
    try {
      const file = await option.pick();
      if (file !== null) {
        onClose();
        onPicked(file);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The file picker could not open. Please try again.",
      );
    } finally {
      picking.current = false;
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t("addReport.title")}>
      <View style={{ gap: 8 }}>
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <PressableScale
              key={option.labelKey}
              accessibilityLabel={t(option.labelKey)}
              onPress={() => void handle(option)}
              disabled={busy}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.hairline,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.sm,
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={20} strokeWidth={1.5} color={colors.ink} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{t(option.labelKey)}</Text>
                <Text variant="caption" tone="soft">
                  {t(option.hintKey)}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
      {error && (
        <Text
          accessibilityRole="alert"
          variant="caption"
          tone="alert"
          style={{ marginTop: 12 }}
        >
          {error}
        </Text>
      )}
      {/* Stated only when this build can actually honour it. */}
      <Text
        variant="caption"
        tone="soft"
        style={{ marginTop: 16, lineHeight: 18 }}
      >
        {onDevice
          ? "Photos are read here on your phone — only the extracted text is sent to be structured. PDFs are uploaded and read in the cloud."
          : t("addReport.footer")}
      </Text>
    </Sheet>
  );
}
