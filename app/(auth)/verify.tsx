import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, View } from "react-native";
import Animated from "react-native-reanimated";

import { error as errorHaptic, success } from "@/lib/haptics";
import { supabase } from "@/lib/supabase";
import { enterUp, OTPInput, PressableScale, Screen, Text } from "@/ui";

// Must match the Supabase project's "OTP Length" (Authentication → Sign In /
// Providers → Email). This project issues 8, and the screen auto-submits the
// moment it has CODE_LENGTH digits — set to 6 it submitted a truncated code
// and no one could ever sign in by email.
// ponytail: coupled by hand to a dashboard setting; if Supabase gains an API
// for it, read it instead of hardcoding.
const CODE_LENGTH = 8;
const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (code.length === CODE_LENGTH && !verifying) {
      void verify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const verify = async (token: string): Promise<void> => {
    if (typeof email !== "string") return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setVerifying(false);
    if (verifyError !== null) {
      errorHaptic();
      setError(t("auth.wrongCode"));
      setCode("");
      return;
    }
    success();
    router.replace("/(tabs)");
  };

  const resend = async (): Promise<void> => {
    if (typeof email !== "string") return;
    setResendIn(RESEND_SECONDS);
    setError(null);
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  };

  return (
    <Screen>
      {/* Edge-to-edge Android ignores adjustResize, so pad on both platforms. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <Animated.View entering={enterUp(0)}>
            <Text variant="title">{t("auth.verifyTitle")}</Text>
          </Animated.View>
          <Animated.View entering={enterUp(1)} style={{ marginBottom: 12 }}>
            <Text variant="label" tone="soft">
              {t("auth.sentTo", { email: typeof email === "string" ? email : "" })}
            </Text>
          </Animated.View>
          <OTPInput length={CODE_LENGTH} value={code} onChange={setCode} invalid={error !== null} />
          <View style={{ minHeight: 24, marginTop: 4 }}>
            {error !== null && (
              <Animated.View entering={enterUp(0)}>
                <Text variant="caption" tone="alert" style={{ textAlign: "center" }}>
                  {error}
                </Text>
              </Animated.View>
            )}
            {verifying && (
              <Animated.View entering={enterUp(0)}>
                <Text variant="caption" tone="soft" style={{ textAlign: "center" }}>
                  {t("auth.verifying")}
                </Text>
              </Animated.View>
            )}
          </View>
        </View>
        <Animated.View entering={enterUp(2)} style={{ alignItems: "center", gap: 4 }}>
          {resendIn > 0 ? (
            <Text variant="caption" tone="faint">
              {t("auth.resendIn", { seconds: resendIn })}
            </Text>
          ) : (
            <PressableScale
              onPress={() => void resend()}
              style={{ paddingHorizontal: 16, justifyContent: "center" }}
            >
              <Text variant="label" tone="accent">
                {t("auth.resend")}
              </Text>
            </PressableScale>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
