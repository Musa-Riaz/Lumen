"use client";

import { Sidebar } from "@/components/chat/sidebar";
import { MessageFeed } from "@/components/chat/message-feed";
import { InputArea } from "@/components/chat/input-area";
import { WelcomeSplash } from "@/components/chat/welcome-splash";
import { useSessions, useMessages, Message } from "@/lib/hooks";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();
  const {
    sessions,
    loading: sessionsLoading,
    fetchSessions,
    createSession,
  } = useSessions();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { messages, fetchMessages } = useMessages(activeSessionId);

  // Local state during streaming
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState("");

  // Refs for managing typewriter queue, abort controller, and async callbacks
  const abortControllerRef = useRef<AbortController | null>(null);
  const incomingBufferRef = useRef("");
  const typewriterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamFinishedRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);

  // Keep ref in sync with state for access within callbacks
  const setSessionIdAndRef = (id: string | null) => {
    setActiveSessionId(id);
    activeSessionIdRef.current = id;
  };

  // Sync ref on initial mounts or list clicks
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Clean timer references on drop
  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
      }
    };
  }, []);

  // Fetch list of sessions once authed on mount
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchSessions();
    }
  }, [isLoaded, isSignedIn, fetchSessions]);

  // Handle active session click
  const handleSelectSession = (id: string | null) => {
    if (isStreaming) {
      if (!confirm("A research script is currently running. Leave active session?")) {
        return;
      }
    }
    setSessionIdAndRef(id);
    setInputVal("");
  };

  // Create new session button selection
  const handleCreateSession = () => {
    if (isStreaming) {
      if (!confirm("A research script is currently running. Start new session?")) {
        return;
      }
    }
    setSessionIdAndRef(null);
    setInputVal("");
  };

  const handleSelectSuggestion = (topic: string) => {
    setInputVal(topic);
  };

  // Stop active stream and typewriter loops immediately
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    incomingBufferRef.current = "";
    isStreamFinishedRef.current = false;

    setIsStreaming(false);
    setStreamingContent("");
    setProgressMessages([]);
    setCurrentPrompt(null);
  };

  // Setup typewriter scroll queue
  const startTypewriter = (onComplete: () => Promise<void>) => {
    if (typewriterTimerRef.current) return;

    typewriterTimerRef.current = setInterval(async () => {
      const buffer = incomingBufferRef.current;
      if (buffer.length > 0) {
        // Grow cursor increment based on queue depth to prevent lag latency
        const pullCount = Math.max(1, Math.floor(buffer.length / 15));
        const chunk = buffer.slice(0, pullCount);
        incomingBufferRef.current = buffer.slice(pullCount);
        setStreamingContent((prev) => prev + chunk);
      } else if (isStreamFinishedRef.current) {
        clearInterval(typewriterTimerRef.current!);
        typewriterTimerRef.current = null;
        await onComplete();
      }
    }, 15);
  };

  // Core research request handler
  const handleSendMessage = async (text: string) => {
    if (isStreaming) return;

    setIsStreaming(true);
    setStreamingContent("");
    setProgressMessages([]);
    setCurrentPrompt(text);
    setInputVal(""); // Reset input box

    let sessionId = activeSessionIdRef.current;
    isStreamFinishedRef.current = false;
    incomingBufferRef.current = "";

    // 1. Setup Abort Signal
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 2. Start Typewriter Interval loop
    startTypewriter(async () => {
      const activeId = activeSessionIdRef.current;
      if (activeId) {
        await fetchMessages(activeId);
      }
      await fetchSessions();
      setIsStreaming(false);
      setStreamingContent("");
      setProgressMessages([]);
      setCurrentPrompt(null);
    });

    try {
      // 3. Create a session in DB first if none is active
      if (!sessionId) {
        const createdId = await createSession(
          text.slice(0, 50) + "...",
          text
        );
        if (!createdId) {
          throw new Error("Unable to create database chat session.");
        }
        sessionId = createdId;
        setSessionIdAndRef(sessionId);
      }

      // 4. Call research api stream endpoint
      const response = await fetch("/api/research/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: text, session_id: sessionId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Research stream error: " + response.statusText);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to initialize readable data stream.");
      }

      const decoder = new TextDecoder();
      let streamBuffer = "";
      let currentEvent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            currentEvent = "";
            continue;
          }

          if (trimmed.startsWith("event: ")) {
            currentEvent = trimmed.substring(7).trim();
          } else if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.substring(6).trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === "session") {
                if (!sessionId && parsed.session_id) {
                  sessionId = parsed.session_id;
                  setSessionIdAndRef(sessionId);
                }
              } else if (currentEvent === "progress") {
                if (parsed.message) {
                  setProgressMessages((prev) => {
                    const cleanMsg = parsed.message;
                    if (prev.includes(cleanMsg)) return prev;
                    return [...prev, cleanMsg];
                  });
                }
              } else if (currentEvent === "token") {
                if (parsed.token) {
                  incomingBufferRef.current += parsed.token;
                }
              } else if (currentEvent === "error") {
                throw new Error(parsed.message || "Agent execution failed.");
              }
            } catch (err) {
              console.error("Payload decoding failure", err, line);
            }
          }
        }
      }

      // Signal completion to typewriter tick
      isStreamFinishedRef.current = true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Stream successfully aborted by user request.");
        return;
      }
      console.error(err);
      alert(err instanceof Error ? err.message : "Error streaming response");
      // Stop execution logs immediately
      handleStop();
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Derive message list dynamically on each render pass
  const renderedMessages = [...messages];
  if (currentPrompt) {
    renderedMessages.push({
      id: "temp-user-msg-" + Date.now(),
      session_id: activeSessionId || "",
      role: "user",
      content: currentPrompt,
      citations: [],
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar Navigation */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        loading={sessionsLoading}
      />

      {/* Main Panel */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background/50 relative">
        {/* Top Header */}
        <div className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-background/60 backdrop-blur-md z-10 select-none">
          <div className="flex flex-col">
            <span className="font-semibold text-xs leading-none">
              {activeSessionId
                ? sessions.find((s) => s.id === activeSessionId)?.title || "Active Research Session"
                : "Deep Research Sandbox"}
            </span>
            <span className="text-[10px] text-muted-foreground mt-1">
              {activeSessionId ? "Loaded from Neon SQL Store" : "Powered by LangGraph Agentic Pipeline"}
            </span>
          </div>
        </div>

        {/* Messaging Board OR Welcome suggestions */}
        {renderedMessages.length === 0 && !isStreaming ? (
          <WelcomeSplash onSelectSuggestion={handleSelectSuggestion} />
        ) : (
          <MessageFeed
            messages={renderedMessages}
            progressMessages={progressMessages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
          />
        )}

        {/* Controlled Prompt Input */}
        <InputArea
          value={inputVal}
          onChange={setInputVal}
          onSend={handleSendMessage}
          onStop={handleStop}
          disabled={isStreaming}
        />
      </main>
    </div>
  );
}
