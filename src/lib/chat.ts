import { Platform } from "react-native";

import { currentLanguage } from "@/i18n";

import { API_URL, fetchWithTimeout } from "./http";
import { supabase } from "./supabase";

export interface ChatCitation {
  report_id: string;
  title: string;
  occurred_at: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  answer: string;
  citations: ChatCitation[];
}

export interface VoiceReply extends ChatReply {
  /** What MedTrace heard — shown as the user's bubble. Empty if unintelligible. */
  transcript: string;
}

/** Send the conversation to the grounded chat endpoint. Throws if unreachable. */
export async function sendChat(messages: ChatTurn[]): Promise<ChatReply> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token === undefined) throw new Error("Not signed in");

  const response = await fetchWithTimeout(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    // The user's language preference rides on every AI call so answers,
    // insights, and report explanations come back in their language.
    body: JSON.stringify({ messages: messages.slice(-30), language: currentLanguage() }),
  }, 45_000);
  if (!response.ok) {
    throw new Error(`Chat request failed (${response.status})`);
  }
  return (await response.json()) as ChatReply;
}

/**
 * Send a recorded voice note plus the prior text turns. The server
 * transcribes and answers in one grounded call.
 */
export async function sendVoiceChat(audioUri: string, history: ChatTurn[]): Promise<VoiceReply> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token === undefined) throw new Error("Not signed in");

  const form = new FormData();
  if (Platform.OS === "web") {
    // A browser's FormData only understands Blob/File. The RN descriptor in
    // the other branch would be appended as the string "[object Object]" and
    // the API would reject the turn as a missing file. Same fetch-the-uri
    // trick uploadReport() already uses for browser picker URLs.
    const blob = await (await fetch(audioUri)).blob();
    // Send the container the browser actually produced — expo-audio records
    // webm/Opus on web, not the AAC the native branch sends. Relabelling it
    // as audio/mp4 would hand the model bytes that do not match the type.
    const type = blob.type || "audio/webm";
    const ext = type.includes("ogg") ? "ogg" : "webm";
    form.append("audio", new File([blob], `voice.${ext}`, { type }));
  } else {
    // React Native's FormData takes a {uri, name, type} descriptor for files.
    form.append("audio", {
      uri: audioUri,
      name: "voice.m4a",
      type: "audio/mp4",
    } as unknown as Blob);
  }
  form.append("history", JSON.stringify(history.slice(-30)));
  form.append("language", currentLanguage());

  // Upload + transcription + answer can legitimately take a while.
  const response = await fetchWithTimeout(
    `${API_URL}/voice`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    },
    60_000,
  );
  if (!response.ok) {
    throw new Error(`Voice request failed (${response.status})`);
  }
  return (await response.json()) as VoiceReply;
}
