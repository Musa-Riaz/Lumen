"use client";

import { useCallback, useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  topic: string | null;
  created_at: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Array<{ url: string; title?: string }>;
  created_at: string | null;
}

// ---------------------------------------------------------------------------
// useSessions — list + create sessions
// ---------------------------------------------------------------------------

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    await Promise.resolve(); // yields to microtasks loop (avoids sync setState in effects)
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(
    async (title?: string, topic?: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title ?? "New Research Session", topic }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        await fetchSessions(); // Refresh list
        return data.session_id as string;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create session");
        return null;
      }
    },
    [fetchSessions]
  );

  return { sessions, loading, error, fetchSessions, createSession };
}

// ---------------------------------------------------------------------------
// useMessages — fetch messages for a session
// ---------------------------------------------------------------------------

export function useMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async (overrideSessionId?: string) => {
    await Promise.resolve(); // yields to microtasks loop (avoids sync setState in effects)
    const id = overrideSessionId || sessionId;
    if (!id) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${id}/messages`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Hook side-effect auto-triggers fetch on session ID changes
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return { messages, loading, error, fetchMessages };
}
