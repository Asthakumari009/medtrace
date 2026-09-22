import { type ErrorBoundaryProps } from "expo-router";
import { HeartPulse } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button, Text, ThemeProvider, useTheme } from "@/ui";

/**
 * Phase 12: the screen behind expo-router's ErrorBoundary. Whatever broke,
 * the user gets a calm, branded recovery path — never a red box or a frozen
 * tree. Wrapped in its own ThemeProvider because the boundary renders
 * outside the app's provider stack.
 */

function CrashBody({ retry }: { retry: ErrorBoundaryProps["retry"] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.fill,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
        }}
      >
        <HeartPulse size={32} strokeWidth={1.5} color={colors.ink} />
      </View>
      <Text variant="heading" style={{ textAlign: "center" }}>
        {t("crash.title", "Something went wrong")}
      </Text>
      <Text
        variant="label"
        tone="soft"
        style={{ textAlign: "center", lineHeight: 22, maxWidth: 300 }}
      >
        {t("crash.body", "Your data is safe. Reload the screen to pick up where you left off.")}
      </Text>
      <Button
        title={t("crash.retry", "Reload")}
        onPress={() => void retry()}
        style={{ alignSelf: "stretch", marginTop: 12 }}
        accessibilityLabel={t("crash.retry", "Reload")}
      />
    </View>
  );
}

export function CrashScreen(props: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <CrashBody retry={props.retry} />
    </ThemeProvider>
  );
}
