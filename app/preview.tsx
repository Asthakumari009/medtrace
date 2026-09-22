import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ArrowUp,
  ArrowUpRight,
  Moon,
  ScanLine,
  Sun,
} from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomNavigation } from "@/components/TabBar";
import { Dashboard } from "@/components/health/Dashboard";
import {
  ExperienceProvider,
  type Destination,
} from "@/components/health/Experience";
import {
  Brand,
  healthStyles as s,
  Tag,
} from "@/components/health/Primitives";
import { Records } from "@/components/health/Records";
import { demoHealthData } from "@/lib/demo";
import {
  Button,
  Input,
  PressableScale,
  radius,
  Screen,
  Text,
  useTheme,
} from "@/ui";
import { KeyboardFrame } from "@/ui/KeyboardFrame";

export default function Preview() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Destination>("home");
  const data = useMemo(demoHealthData, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.accent }}>
        <View
          style={[
            s.between,
            {
              paddingLeft: Math.max(20, insets.left),
              paddingRight: Math.max(20, insets.right),
              minHeight: 38,
              maxWidth: 1040,
              width: "100%",
              alignSelf: "center",
            },
          ]}
        >
          <Text
            variant="eyebrow"
            tone="onAccent"
            style={{ flex: 1, paddingRight: 12 }}
          >
            A look inside MedTrace · Sample data
          </Text>
          <PressableScale
            onPress={() => router.replace("/(auth)/welcome")}
            style={{ minHeight: 44, maxWidth: "40%", justifyContent: "center" }}
          >
            <Text variant="caption" tone="onAccent">
              Exit preview
            </Text>
          </PressableScale>
        </View>
      </View>
      <ExperienceProvider demo data={data} navigate={setPage}>
        {page === "home" ? (
          <Dashboard />
        ) : page === "records" ? (
          <Records />
        ) : page === "chat" ? (
          <PreviewChat />
        ) : (
          <PreviewProfile />
        )}
        <BottomNavigation selected={page} onNavigate={setPage} />
      </ExperienceProvider>
    </View>
  );
}

function PreviewChat() {
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<
    { question: string; answer: string }[]
  >([]);

  const send = (question: string) => {
    if (!question.trim()) return;
    const q = question.toLowerCase();
    const answer = q.includes("flag")
      ? "In this sample, one value — HbA1c at 5.8% against a printed range of 4.0–5.6 — is marked by the laboratory. MedTrace never interprets a flag; it shows you the printed range and points you at the source report."
      : q.includes("report")
        ? "The sample annual health check contains 12 observations, including one lab-flagged value. In your account, an answer links directly to the source report so you can verify each result with your clinician."
        : "This is a sample conversation. With your own account, MedTrace answers from your medical records only, cites the reports it used, and tells you when the records do not contain an answer.";
    setMessages((v) => [...v, { question: question.trim(), answer }]);
    setDraft("");
  };

  return (
    <Screen tabbed animated={false}>
      <KeyboardFrame>
        <View style={[s.between, { marginBottom: 22 }]}>
          <Brand small />
          <Tag label="Sample conversation" />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: messages.length ? "flex-start" : "center",
            paddingBottom: 20,
          }}
        >
          {messages.length === 0 ? (
            <View style={{ gap: 18 }}>
              <View
                style={{
                  backgroundColor: colors.fill,
                  width: 60,
                  height: 60,
                  borderRadius: radius.md,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ScanLine size={26} color={colors.ink} strokeWidth={1.7} />
              </View>
              <Text variant="title">
                {"Ask your records\nanything."}
              </Text>
              <Text variant="body" tone="soft" style={{ lineHeight: 25 }}>
                Every real answer is grounded in the reports you added, and
                cites the ones it used.
              </Text>
              {["What do my reports show?", "Was anything flagged?"].map((q) => (
                <PressableScale
                  key={q}
                  onPress={() => send(q)}
                  style={[
                    s.between,
                    s.panel,
                    {
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.hairline,
                    },
                  ]}
                >
                  <Text variant="label" style={{ flex: 1 }}>
                    {q}
                  </Text>
                  <ArrowUpRight size={18} color={colors.inkSoft} />
                </PressableScale>
              ))}
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={{ gap: 12, marginBottom: 22 }}>
                <View
                  style={[
                    s.panel,
                    {
                      alignSelf: "flex-end",
                      maxWidth: "90%",
                      backgroundColor: colors.fill,
                    },
                  ]}
                >
                  <Text variant="label">{m.question}</Text>
                </View>
                <View
                  style={[
                    s.panel,
                    {
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.hairline,
                    },
                  ]}
                >
                  <Text variant="label" style={{ lineHeight: 24 }}>
                    {m.answer}
                  </Text>
                  <Text variant="caption" tone="soft" style={{ marginTop: 13 }}>
                    Preview explanation · no AI request sent
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <View style={[s.row, { gap: 8 }]}>
          <Input
            accessibilityLabel="Ask a preview question"
            placeholder="Ask about your records…"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send(draft)}
            style={{ flex: 1 }}
          />
          <PressableScale
            accessibilityLabel="Send preview question"
            onPress={() => send(draft)}
            disabled={!draft.trim()}
            style={{
              backgroundColor: colors.accent,
              borderRadius: radius.pill,
              width: 51,
              height: 51,
              justifyContent: "center",
              alignItems: "center",
              opacity: draft.trim() ? 1 : 0.5,
            }}
          >
            <ArrowUp size={21} color={colors.onAccent} strokeWidth={2} />
          </PressableScale>
        </View>
      </KeyboardFrame>
    </Screen>
  );
}

function PreviewProfile() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  return (
    <Screen scroll tabbed>
      <Text variant="title" style={{ marginBottom: 20 }}>
        Your record, your call.
      </Text>
      <View
        style={[
          s.panel,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            gap: 14,
          },
        ]}
      >
        <Tag label="Preview profile" />
        <Text variant="heading">Keep every report in one place.</Text>
        <Text variant="label" tone="soft" style={{ lineHeight: 21 }}>
          Photographed reports are read on your phone. Only the extracted text
          is sent to be structured.
        </Text>
        <Button
          title="Create your private account"
          onPress={() => router.push("/(auth)/email")}
        />
      </View>

      <Text variant="heading" style={{ marginTop: 28, marginBottom: 14 }}>
        Appearance
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {(["light", "dark", "system"] as const).map((m) => (
          <PressableScale
            key={m}
            accessibilityLabel={`${m} appearance`}
            accessibilityState={{ selected: mode === m }}
            onPress={() => void setMode(m)}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: mode === m ? colors.ink : colors.hairline,
              backgroundColor: mode === m ? colors.fill : "transparent",
              alignItems: "center",
              gap: 10,
            }}
          >
            {m === "dark" ? (
              <Moon size={20} color={colors.ink} />
            ) : (
              <Sun size={20} color={colors.ink} />
            )}
            <Text variant="caption">
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </Text>
          </PressableScale>
        ))}
      </View>
      <Text
        variant="caption"
        tone="soft"
        style={{ marginTop: 25, lineHeight: 20 }}
      >
        Preview data is synthetic and clears when you leave. Your real account
        keeps reports in private storage only you can read.
      </Text>
    </Screen>
  );
}
