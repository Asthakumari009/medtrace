import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, View } from "react-native";
import Animated from "react-native-reanimated";

import { supabase } from "@/lib/supabase";
import { Button, enterUp, Input, Screen, Text } from "@/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL_RE.test(email.trim());

  const sendCode = async (): Promise<void> => {
    const address = email.trim().toLowerCase();
    setSending(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    // Email rate limits shouldn't strand the user here — they may already
    // have a valid code, so let them through to enter it.
    if (otpError !== null && !/rate limit|request this after/i.test(otpError.message)) {
      setError(otpError.message);
      return;
    }
    router.push({ pathname: "/(auth)/verify", params: { email: address } });
  };

  return (
    <Screen>
      {/* Edge-to-edge Android ignores adjustResize, so pad on both platforms. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <Animated.View entering={enterUp(0)}>
            <Text variant="title">{t("auth.emailTitle")}</Text>
          </Animated.View>
          <Animated.View entering={enterUp(1)} style={{ marginBottom: 8 }}>
            <Text variant="label" tone="soft">
              {t("auth.emailSub")}
            </Text>
          </Animated.View>
          <Animated.View entering={enterUp(2)}>
            <Input
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError(null);
              }}
              placeholder={t("auth.emailPlaceholder")}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              autoFocus
              invalid={error !== null}
              onSubmitEditing={() => {
                if (valid && !sending) void sendCode();
              }}
              returnKeyType="send"
            />
          </Animated.View>
          {error !== null && (
            <Animated.View entering={enterUp(0)}>
              <Text variant="caption" tone="alert">
                {error}
              </Text>
            </Animated.View>
          )}
        </View>
        <Animated.View entering={enterUp(3)}>
          <Button
            title={t("auth.sendCode")}
            onPress={() => void sendCode()}
            disabled={!valid}
            loading={sending}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
