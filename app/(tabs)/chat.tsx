import { FlashList, type FlashListRef } from "@shopify/flash-list";
import * as Speech from "expo-speech";
import { ArrowUp, MessageCircle, Mic, Sparkles, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, ScrollView, View } from "react-native";
import { KeyboardFrame } from "@/ui/KeyboardFrame";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Brand } from "@/components/health/Primitives";
import { ChatBubble } from "@/components/ChatBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { type ChatMessage, useChat } from "@/hooks/useChat";
import { useVoiceNote } from "@/hooks/useVoiceNote";
import { currentLanguage } from "@/i18n";
import { select, warning } from "@/lib/haptics";
import {
  Card,
  enterUp,
  Input,
  PressableScale,
  radius,
  Screen,
  Text,
  useTheme,
} from "@/ui";

const SUGGESTION_KEYS = ["chat.suggestion1", "chat.suggestion2", "chat.suggestion3"];

/** BCP-47 voices for the three app languages. */
const SPEECH_LOCALES: Record<string, string> = {
  en: "en-US",
  te: "te-IN",
  hi: "hi-IN",
};

/** Recordings shorter than this are taps, not questions — discard them. */
const MIN_VOICE_MS = 700;
/** Safety stop so a forgotten recording can't run forever. */
const MAX_VOICE_MS = 180_000;

/** 1.5s breathing dot while MedTrace listens (static under reduced motion). */
function ListeningDot() {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [opacity, reducedMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
        style,
      ]}
    />
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function ChatScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { messages, thinking, error, send, sendVoice, retry } = useChat();
  const voice = useVoiceNote();
  const [draft, setDraft] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const spokenIds = useRef(new Set<string>());

  const canSend = draft.trim() !== "" && !thinking;
  const showMic = draft.trim() === "" && !thinking;

  // Keep the latest messages in view when the keyboard shrinks the list.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  // Voice answers are read aloud once, in the user's language.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (
      last !== undefined &&
      last.role === "assistant" &&
      last.viaVoice === true &&
      !spokenIds.current.has(last.id)
    ) {
      spokenIds.current.add(last.id);
      Speech.speak(last.content, {
        language: SPEECH_LOCALES[currentLanguage()] ?? "en-US",
      });
    }
  }, [messages]);

  // Leaving the screen mid-sentence should not leave a voice talking.
  useEffect(() => () => void Speech.stop(), []);

  // Safety stop for forgotten recordings.
  useEffect(() => {
    if (voice.recording && voice.durationMs >= MAX_VOICE_MS) {
      void stopAndSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.durationMs, voice.recording]);

  const submit = (): void => {
    if (!canSend) return;
    send(draft);
    setDraft("");
  };

  const startRecording = async (): Promise<void> => {
    if (thinking || voice.recording) return;
    void Speech.stop();
    setVoiceError(null);
    select();
    const granted = await voice.start();
    if (!granted) setVoiceError(t("chat.voiceDenied"));
  };

  const stopAndSend = async (): Promise<void> => {
    const duration = voice.durationMs;
    select();
    const uri = await voice.stop();
    if (uri === null || duration < MIN_VOICE_MS) return;
    sendVoice(uri, t("chat.voiceNote"));
  };

  const discardRecording = async (): Promise<void> => {
    warning();
    await voice.cancel();
  };

  return (
    <Screen tabbed animated={false}>
      {/* Edge-to-edge Android ignores adjustResize, so pad on both platforms. */}
      <KeyboardFrame>
        <Animated.View entering={enterUp(0)} style={{ paddingTop: 8, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Brand small /><Text variant="caption" tone="soft">{t("chat.title")}</Text></View>
        </Animated.View>

        {messages.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", gap: 12, paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              entering={enterUp(0)}
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: colors.fill,
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "flex-start",
                marginBottom: 4,
              }}
            >
              <MessageCircle size={32} strokeWidth={1.5} color={colors.ink} />
            </Animated.View>
            <Animated.View entering={enterUp(1)}>
              <Text variant="title" style={{ textAlign: "left" }}>
                {t("chat.emptyTitle")}
              </Text>
            </Animated.View>
            <Animated.View entering={enterUp(2)} style={{ alignSelf: "flex-start", maxWidth: 380 }}>
              <Text variant="label" tone="soft" style={{ textAlign: "left", lineHeight: 24 }}>
                {t("chat.emptyBody")}
              </Text>
            </Animated.View>
            <View style={{ gap: 8, marginTop: 12 }}>
              {SUGGESTION_KEYS.map((key, i) => {
                const suggestion = t(key);
                return (
                  <Animated.View key={key} entering={enterUp(3 + i)}>
                    <PressableScale
                      accessibilityLabel={t("chat.ask", { suggestion })}
                      onPress={() => send(suggestion)}
                      disabled={thinking}
                    >
                      <Card rounded="md">
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Sparkles size={16} strokeWidth={1.5} color={colors.ink} />
                          <Text variant="label" tone="soft" style={{ flex: 1 }}>
                            {suggestion}
                          </Text>
                        </View>
                      </Card>
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
            <Animated.View entering={enterUp(6)}>
              <Text variant="caption" tone="faint" style={{ textAlign: "center", marginTop: 8 }}>
                {t("chat.disclaimer")}
              </Text>
            </Animated.View>
          </ScrollView>
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            keyExtractor={(item: ChatMessage) => item.id}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }: { item: ChatMessage }) => (
              <Animated.View entering={enterUp(0)}>
                <ChatBubble message={item} />
              </Animated.View>
            )}
            ListFooterComponent={
              thinking ? (
                <Animated.View entering={enterUp(0)} style={{ paddingTop: 12 }}>
                  <TypingIndicator />
                </Animated.View>
              ) : null
            }
          />
        )}

        {(error !== null || voiceError !== null) && (
          <Animated.View entering={enterUp(0)} style={{ paddingBottom: 8 }}>
            <Card style={{ backgroundColor: colors.alertSoft, borderColor: "transparent" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text variant="caption" tone="alert" style={{ flex: 1 }}>
                  {error ?? voiceError}
                </Text>
                {error !== null ? (
                  <PressableScale
                    accessibilityLabel={t("chat.retrySend")}
                    onPress={retry}
                    style={{ paddingHorizontal: 8, justifyContent: "center" }}
                  >
                    <Text variant="caption" tone="accent">
                      {t("common.tryAgain")}
                    </Text>
                  </PressableScale>
                ) : (
                  <PressableScale
                    accessibilityLabel={t("common.close")}
                    onPress={() => setVoiceError(null)}
                    style={{ paddingHorizontal: 8, justifyContent: "center" }}
                  >
                    <Text variant="caption" tone="accent">
                      {t("common.gotIt")}
                    </Text>
                  </PressableScale>
                )}
              </View>
            </Card>
          </Animated.View>
        )}

        {voice.recording ? (
          <Animated.View
            entering={enterUp(0)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 }}
          >
            <PressableScale
              accessibilityLabel={t("chat.voiceCancel")}
              onPress={() => void discardRecording()}
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.hairline,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} strokeWidth={1.5} color={colors.inkSoft} />
            </PressableScale>

            <View
              style={{
                flex: 1,
                height: 52,
                borderRadius: radius.md,
                backgroundColor: colors.fill,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 16,
              }}
            >
              <ListeningDot />
              <Text variant="label" tone="accent" style={{ flex: 1 }}>
                {t("chat.listening")}
              </Text>
              <Text variant="caption" tone="soft">
                {formatDuration(voice.durationMs)}
              </Text>
            </View>

            <PressableScale
              accessibilityLabel={t("chat.voiceStop")}
              onPress={() => void stopAndSend()}
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUp size={22} strokeWidth={2} color={colors.onAccent} />
            </PressableScale>
          </Animated.View>
        ) : (
          <Animated.View
            entering={enterUp(1)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 }}
          >
            <Input
              maxLength={4000}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("chat.placeholder")}
              returnKeyType="send"
              onSubmitEditing={submit}
              editable={!thinking}
              style={{ flex: 1 }}
              accessibilityLabel={t("chat.placeholder")}
            />
            {showMic ? (
              <PressableScale
                accessibilityLabel={t("chat.voiceStart")}
                onPress={() => void startRecording()}
                disabled={thinking}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.pill,
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mic size={22} strokeWidth={1.7} color={colors.ink} />
              </PressableScale>
            ) : (
              <PressableScale
                accessibilityLabel={t("chat.send")}
                onPress={submit}
                disabled={!canSend}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.pill,
                  backgroundColor: canSend ? colors.accent : colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowUp
                  size={22}
                  strokeWidth={2}
                  color={canSend ? colors.onAccent : colors.inkSoft}
                />
              </PressableScale>
            )}
          </Animated.View>
        )}
      </KeyboardFrame>
    </Screen>
  );
}
