import { t } from "i18next";
import { useCallback, useRef, useState } from "react";

import { type ChatCitation, type ChatTurn, sendChat, sendVoiceChat } from "@/lib/chat";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  /** True when this turn travelled by voice — the answer is read aloud. */
  viaVoice?: boolean;
}

interface UseChatResult {
  messages: ChatMessage[];
  thinking: boolean;
  error: string | null;
  send: (text: string) => void;
  /** Send a recorded voice note; `fallbackLabel` stands in for an empty transcript. */
  sendVoice: (audioUri: string, fallbackLabel: string) => void;
  retry: () => void;
}

let nextId = 0;
const newId = (): string => `msg-${++nextId}`;

interface PendingVoice {
  uri: string;
  fallbackLabel: string;
  turns: ChatTurn[];
}

/**
 * In-session chat state. History lives in memory only — the conversation
 * resets with the app, but every turn is re-grounded in the user's records
 * server-side, so nothing is lost.
 */
export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whatever is awaiting an answer, kept for retry after a failure.
  const busy = useRef(false);
  const pendingTurns = useRef<ChatTurn[] | null>(null);
  const pendingVoice = useRef<PendingVoice | null>(null);

  const run = useCallback(async (turns: ChatTurn[]): Promise<void> => {
    busy.current = true;
    setThinking(true);
    setError(null);
    try {
      const reply = await sendChat(turns);
      pendingTurns.current = null;
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: reply.answer, citations: reply.citations },
      ]);
    } catch {
      setError(t("chat.error"));
    } finally {
      busy.current = false;
      setThinking(false);
    }
  }, []);

  const runVoice = useCallback(async (pending: PendingVoice): Promise<void> => {
    busy.current = true;
    setThinking(true);
    setError(null);
    try {
      const reply = await sendVoiceChat(pending.uri, pending.turns);
      pendingVoice.current = null;
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "user",
          content: reply.transcript !== "" ? reply.transcript : pending.fallbackLabel,
          viaVoice: true,
        },
        {
          id: newId(),
          role: "assistant",
          content: reply.answer,
          citations: reply.citations,
          viaVoice: true,
        },
      ]);
    } catch {
      setError(t("chat.error"));
    } finally {
      busy.current = false;
      setThinking(false);
    }
  }, []);

  const send = useCallback(
    (text: string): void => {
      const content = text.trim();
      if (content === "" || thinking || busy.current) return;
      const userMessage: ChatMessage = { id: newId(), role: "user", content };
      const turns = [...messages, userMessage].map(
        (m): ChatTurn => ({ role: m.role, content: m.content }),
      );
      setMessages((prev) => [...prev, userMessage]);
      pendingTurns.current = turns;
      pendingVoice.current = null;
      void run(turns);
    },
    [messages, run, thinking],
  );

  const sendVoice = useCallback(
    (audioUri: string, fallbackLabel: string): void => {
      if (thinking || busy.current) return;
      const pending: PendingVoice = {
        uri: audioUri,
        fallbackLabel,
        turns: messages.map((m): ChatTurn => ({ role: m.role, content: m.content })),
      };
      pendingVoice.current = pending;
      pendingTurns.current = null;
      void runVoice(pending);
    },
    [messages, runVoice, thinking],
  );

  const retry = useCallback((): void => {
    if (thinking || busy.current) return;
    if (pendingVoice.current !== null) {
      void runVoice(pendingVoice.current);
    } else if (pendingTurns.current !== null) {
      void run(pendingTurns.current);
    }
  }, [run, runVoice, thinking]);

  return { messages, thinking, error, send, sendVoice, retry };
}
