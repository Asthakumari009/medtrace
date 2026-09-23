import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  Mail,
  MessageSquareText,
  QrCode,
  ScanLine,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { GoogleMark } from "@/components/GoogleMark";
import { googleSignInAvailable, signInWithGoogle } from "@/lib/googleAuth";
import { error as errorHaptic } from "@/lib/haptics";
import {
  BrandMark,
  Button,
  enterUp,
  PressableScale,
  radius,
  Screen,
  Text,
  useTheme,
} from "@/ui";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ScanLine,
    title: "Read on your phone",
    body: "Photographed reports are recognised on the device. Only the text leaves it.",
  },
  {
    icon: MessageSquareText,
    title: "Ask your own records",
    body: "Every answer points to the report it came from.",
  },
  {
    icon: QrCode,
    title: "Share for minutes, not forever",
    body: "A one-time QR your doctor opens once. Revoke it any time.",
  },
];

/**
 * Sign-in. Laid out as one phone-width column whatever the viewport, so the
 * web build reads as the app rather than a stretched landing page.
 */
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
      // Native: the session lands and (auth)/_layout redirects.
      // Web: the page leaves for Google and the session arrives on return.
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
      <View
        style={{ flex: 1, width: "100%", maxWidth: 420, alignSelf: "center" }}
      >
        <View
          style={{ flex: 1, justifyContent: "center", paddingVertical: 32 }}
        >
          <Animated.View entering={enterUp(0)} style={{ gap: 20 }}>
            <BrandMark size={64} />
            <View style={{ gap: 10 }}>
              <Text variant="eyebrow" tone="soft">
                MedTrace
              </Text>
              <Text variant="title">{"Every report.\nOne record."}</Text>
              <Text variant="body" tone="soft" style={{ lineHeight: 24 }}>
                Your prescriptions, lab results and discharge slips, read and
                organised in one place you control.
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={enterUp(1)}
            style={{ marginTop: 32, gap: 18 }}
          >
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <View
                key={title}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    backgroundColor: colors.fill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={19} color={colors.ink} strokeWidth={1.75} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{title}</Text>
                  <Text
                    variant="caption"
                    tone="soft"
                    style={{ lineHeight: 18 }}
                  >
                    {body}
                  </Text>
                </View>
              </View>
            ))}
          </Animated.View>
        </View>

        <Animated.View entering={enterUp(2)} style={{ gap: 12 }}>
          {googleError !== null && (
            <Text
              accessibilityRole="alert"
              variant="caption"
              tone="alert"
              style={{ textAlign: "center" }}
            >
              {googleError}
            </Text>
          )}
          {hasGoogle && (
            <Button
              title={t("welcome.google")}
              variant="inverse"
              icon={<GoogleMark size={18} />}
              onPress={() => void continueWithGoogle()}
              loading={googleBusy}
            />
          )}
          <Button
            title={t("welcome.cta")}
            variant={hasGoogle ? "secondary" : "primary"}
            icon={
              <Mail
                size={18}
                color={hasGoogle ? colors.ink : colors.onAccent}
                strokeWidth={1.75}
              />
            }
            onPress={() => router.push("/(auth)/email")}
            disabled={googleBusy}
          />
          <PressableScale
            accessibilityLabel="Explore the MedTrace preview"
            onPress={() => router.push("/preview")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minHeight: 44,
            }}
          >
            <Text variant="label" tone="accent">
              Take a look inside
            </Text>
            <ArrowUpRight size={16} color={colors.accentInk} />
          </PressableScale>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <ShieldCheck size={13} color={colors.inkSoft} />
            <Text variant="caption" tone="soft">
              {t("welcome.privacy")}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Screen>
  );
}
