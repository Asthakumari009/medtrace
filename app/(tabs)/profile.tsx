import Constants from "expo-constants";
import {
  Languages,
  LogOut,
  MoonStar,
  QrCode,
  ScanLine,
  ShieldCheck,
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { ShareSheet } from "@/components/ShareSheet";
import { currentLanguage, LANGUAGES, setAppLanguage } from "@/i18n";
import { select } from "@/lib/haptics";
import { onDeviceOcrAvailable } from "@/lib/ocr";
import { displayName } from "@/lib/user";
import { useAuth } from "@/providers/AuthProvider";
import {
  Card,
  PressableScale,
  radius,
  Row,
  Screen,
  SectionHeader,
  Text,
  useTheme,
} from "@/ui";

const THEME_CHOICES = [
  { mode: "system", labelKey: "profile.themeSystem" },
  { mode: "light", labelKey: "profile.themeLight" },
  { mode: "dark", labelKey: "profile.themeDark" },
] as const;

export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [lang, setLang] = useState(currentLanguage());

  const email = session?.user.email ?? "—";
  const name = displayName(session) ?? "You";
  const initial = name.charAt(0).toUpperCase();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const onDevice = onDeviceOcrAvailable();

  const handleSignOut = (): void => {
    setSigningOut(true);
    void signOut().finally(() => setSigningOut(false));
  };

  return (
    <Screen tabbed scroll animated={false}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingBottom: 26,
        }}
      >
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="heading" tone="onAccent">
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="soft" numberOfLines={1}>
            {email}
          </Text>
        </View>
      </View>

      <View style={{ gap: 20 }}>
        <View style={{ gap: 6 }}>
          <SectionHeader title="Privacy" />
          <Card padded={false}>
            <Row
              icon={<QrCode size={18} strokeWidth={1.7} color={colors.ink} />}
              title={t("profile.share")}
              subtitle={t("profile.shareSub")}
              onPress={() => setShareOpen(true)}
            />
          </Card>

          {/* The on-device claim, stated only when this build can honour it. */}
          <Card rounded="lg" style={{ marginTop: 6 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: radius.sm,
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {onDevice ? (
                  <ScanLine size={20} strokeWidth={1.7} color={colors.ink} />
                ) : (
                  <ShieldCheck size={20} strokeWidth={1.7} color={colors.ink} />
                )}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="label">
                  {onDevice ? "Reports are read on this phone" : "Your data, your call"}
                </Text>
                <Text variant="caption" tone="soft" style={{ lineHeight: 18 }}>
                  {onDevice
                    ? "Photographed reports are recognised here and only the extracted text is sent. PDFs are read in the cloud."
                    : "Reports are uploaded to private storage only you can read, and shared only when you generate a link."}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={{ gap: 6 }}>
          <SectionHeader title={t("profile.sectionApp")} />
          <Card padded={false}>
            <Row
              icon={<MoonStar size={18} strokeWidth={1.7} color={colors.ink} />}
              title={t("profile.appearance")}
              subtitle={t("profile.appearanceSub")}
            />
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 16,
                paddingBottom: 14,
              }}
            >
              {THEME_CHOICES.map((choice) => {
                const selected = mode === choice.mode;
                const label = t(choice.labelKey);
                return (
                  <PressableScale
                    key={choice.mode}
                    haptic={false}
                    accessibilityLabel={t("profile.themeA11y", { label })}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      select();
                      setMode(choice.mode);
                    }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: selected ? colors.ink : colors.hairline,
                      backgroundColor: selected ? colors.ink : "transparent",
                    }}
                  >
                    <Text
                      variant="label"
                      style={{ color: selected ? colors.bg : colors.inkSoft }}
                    >
                      {label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairline }} />
            <Row
              icon={<Languages size={18} strokeWidth={1.7} color={colors.ink} />}
              title={t("profile.language")}
              subtitle={t("profile.languageSub")}
            />
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 16,
                paddingBottom: 14,
              }}
            >
              {LANGUAGES.map((choice) => {
                const selected = lang === choice.code;
                return (
                  <PressableScale
                    key={choice.code}
                    haptic={false}
                    accessibilityLabel={choice.native}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      select();
                      setLang(choice.code);
                      void setAppLanguage(choice.code);
                    }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: selected ? colors.ink : colors.hairline,
                      backgroundColor: selected ? colors.ink : "transparent",
                    }}
                  >
                    <Text
                      variant="label"
                      style={{ color: selected ? colors.bg : colors.inkSoft }}
                    >
                      {choice.native}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairline }} />
            <Row
              icon={
                <LogOut
                  size={18}
                  strokeWidth={1.7}
                  color={signingOut ? colors.inkFaint : colors.inkSoft}
                />
              }
              title={t("profile.signOut")}
              chevron={false}
              trailing={
                signingOut ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : undefined
              }
              onPress={signingOut ? undefined : handleSignOut}
            />
          </Card>
        </View>

        <Text variant="eyebrow" tone="faint" style={{ textAlign: "center" }}>
          MedTrace {version}
        </Text>
      </View>

      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </Screen>
  );
}
