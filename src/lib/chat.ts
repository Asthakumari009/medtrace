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
  // React Native's FormData takes a {uri, name, type} descriptor for files.
  form.append("audio", {
    uri: audioUri,
    name: "voice.m4a",
    type: "audio/mp4",
  } as unknown as Blob);
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
