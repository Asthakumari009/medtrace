import { useRouter } from "expo-router";
import { ArrowUpRight, ScanLine, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Brand, healthStyles as hs, Stat } from "@/components/health/Primitives";
import { googleSignInAvailable, signInWithGoogle } from "@/lib/googleAuth";
import { error as errorHaptic } from "@/lib/haptics";
import {
  Button,
  Card,
  enterUp,
  PressableScale,
  radius,
  Screen,
  Text,
  useTheme,
} from "@/ui";

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const hasGoogle = googleSignInAvailable();

  const continueWithGoogle = async (): Promise<void> => {
    if (googleBusy) return;
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      // On success the Supabase session lands and (auth)/_layout redirects.
      await signInWithGoogle();
    } catch {
      errorHaptic();
      setGoogleError(t("welcome.googleError"));
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <Screen animated={false} scroll>
      <View style={[hs.between, { paddingTop: 8 }]}>
        <Brand />
        <View style={[hs.row, { gap: 5 }]}>
          <ShieldCheck size={14} color={colors.inkSoft} />
          <Text variant="eyebrow" tone="soft">
            Private by default
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: "center", paddingVertical: 34 }}>
        <Animated.View entering={enterUp(0)}>
          <Text variant="display" style={{ maxWidth: 420 }}>
            {"Every report.\nOne record."}
          </Text>
          <Text
            variant="body"
            tone="soft"
            style={{ marginTop: 18, maxWidth: 380, lineHeight: 25 }}
          >
            Photograph a lab report and it is read here, on your phone. Only the
            extracted text is sent to be structured.
          </Text>
        </Animated.View>

        <Animated.View entering={enterUp(1)} style={{ marginTop: 28 }}>
          <Card variant="invert" rounded="lg" style={{ padding: 22, gap: 20 }}>
            <View style={[hs.row, { gap: 10 }]}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.sm,
                  backgroundColor: colors.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ScanLine size={19} color={colors.onAccent} strokeWidth={2} />
              </View>
              <Text variant="label" tone="onSurfaceHi" style={{ flex: 1 }}>
                Read on device, structured in the cloud
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 26,
                paddingTop: 18,
                borderTopWidth: 1,
                borderTopColor: colors.onSurfaceHiFaint,
              }}
            >
              <Stat label="Values read" value="12" tone="onSurfaceHi" />
              <Stat label="Uploaded" value="0" tone="onSurfaceHi" />
            </View>
          </Card>
        </Animated.View>
      </View>

      <Animated.View
        entering={enterUp(2)}
        style={{ gap: 12, width: "100%", maxWidth: 430, alignSelf: "center" }}
      >
        {googleError !== null && (
          <Text variant="caption" tone="alert" style={{ textAlign: "center" }}>
            {googleError}
          </Text>
        )}
        {hasGoogle ? (
          <>
            <Button
              title={t("welcome.google")}
              onPress={() => void continueWithGoogle()}
              loading={googleBusy}
              accessibilityLabel={t("welcome.google")}
            />
            <Button
              title={t("welcome.cta")}
              variant="secondary"
              onPress={() => router.push("/(auth)/email")}
              disabled={googleBusy}
              accessibilityLabel={t("welcome.cta")}
            />
          </>
        ) : (
          <Button
            title={t("welcome.cta")}
            onPress={() => router.push("/(auth)/email")}
          />
        )}
        <PressableScale
          accessibilityLabel="Explore the MedTrace preview"
          onPress={() => router.push("/preview")}
          style={[hs.row, { justifyContent: "center", gap: 7 }]}
        >
          <Text variant="label" tone="accent">
            Take a look inside
          </Text>
          <ArrowUpRight size={17} color={colors.accentInk} />
        </PressableScale>
        <Text variant="caption" tone="soft" style={{ textAlign: "center" }}>
          {t("welcome.privacy")}
        </Text>
      </Animated.View>
    </Screen>
  );
}
