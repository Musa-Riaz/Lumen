"use client";

import { Message } from "@/lib/hooks";
import { Sparkle, Link as LinkIcon, CircleNotch } from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";
import {useUser} from "@clerk/nextjs"
import { cn } from "@/lib/utils";

interface MessageFeedProps {
  messages: Message[];
  progressMessages: string[];
  isStreaming: boolean;
  streamingContent: string;
}

export function MessageFeed({
  messages,
  progressMessages,
  isStreaming,
  streamingContent,
}: MessageFeedProps) {
  const { user } = useUser()
  const feedEndRef = useRef<HTMLDivElement>(null);
  const [showProgressLog, setShowProgressLog] = useState(true);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, progressMessages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-6 md:px-8 max-w-screen mx-auto w-full scrollbar-none">
      {messages.map((m) => {
        const isUser = m.role === "user";
        return (
          <div
            key={m.id}
            className={cn(
              "flex gap-3 items-end animate-fade-in",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-sm select-none",
                isUser
                  ? "bg-accent border-accent text-foreground"
                  : "bg-primary border-primary text-primary-foreground"
              )}
            >
              {isUser ? 
              <img
              src={user?.imageUrl || ''}
              alt=""
              className="w-8 h-8 object-cover rounded-lg"
              />
              : <Sparkle size={16} weight="fill" />}
            </div>

            {/* Bubble */}
            <div
              className={cn(
                "flex flex-col gap-2 max-w-[80%]",
                isUser ? "items-end" : "items-start"
              )}
            >
              <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider select-none px-1">
                {isUser ? "You" : "Lumen AI"}
              </span>

              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted/40 border text-foreground/90 rounded-bl-sm"
                )}
              >
                {isUser ? (
                  <p>{m.content}</p>
                ) : (
                  renderMarkdown(m.content)
                )}
              </div>

              {/* Citations / Sources — only for AI messages */}
              {!isUser && m.citations && m.citations.length > 0 && (
                <div className="mt-1 px-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-2 select-none">
                    Sources &amp; Citations
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {m.citations.map((c, idx) => (
                      <a
                        key={idx}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-muted/20 text-[10px] font-mono text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all select-none"
                      >
                        <LinkIcon size={12} />
                        <span className="max-w-37.5 truncate">{c.title || c.url}</span>
                        <span className="text-[9px] text-muted-foreground/50">[{idx + 1}]</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Streaming / Active Message */}
      {isStreaming && (
        <div className="space-y-4">
          {/* Active streaming bubble — left aligned like AI */}
          {streamingContent && (
            <div className="flex gap-3 items-end animate-fade-in flex-row">
              <div className="w-8 h-8 rounded-lg bg-primary border border-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm select-none">
                <Sparkle size={16} weight="fill" />
              </div>
              <div className="flex flex-col gap-2 max-w-[80%] items-start">
                <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider select-none px-1">
                  Lumen AI
                </span>
                <div className="bg-muted/40 border rounded-2xl rounded-bl-sm px-4 py-3 text-xs leading-relaxed space-y-2 text-foreground/90">
                  {renderMarkdown(streamingContent)}
                </div>
              </div>
            </div>
          )}

          {/* Agent execution log / progress box */}
          {progressMessages.length > 0 && (
            <div className={cn("flex gap-3 items-start", streamingContent ? "pl-11" : "")}>
              <div className="flex-1 bg-muted/30 border rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setShowProgressLog(!showProgressLog)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/65 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <CircleNotch size={12} className="animate-spin text-primary" />
                    <span>Agent Research Process</span>
                  </div>
                  <span className="text-[9px] lowercase font-normal">
                    {showProgressLog ? "Click to collapse" : "Click to expand"}
                  </span>
                </button>
                {showProgressLog && (
                  <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                    {progressMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "text-[10px] font-mono leading-relaxed transition-all",
                          idx === progressMessages.length - 1
                            ? "text-primary font-semibold animate-pulse"
                            : "text-muted-foreground"
                        )}
                      >
                        <span className="text-primary-foreground/30 mr-1.5 select-none">&gt;</span>
                        {msg}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Anchor for auto-scroll */}
      <div ref={feedEndRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Lightweight Markdown Parser
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split on triple backticks for code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const content = part.slice(3, -3);
      const firstNewline = content.indexOf("\n");
      let code = content;
      let lang = "";

      if (firstNewline !== -1) {
        lang = content.slice(0, firstNewline).trim();
        code = content.slice(firstNewline + 1);
      }

      return (
        <pre key={idx} className="my-3 p-4 bg-muted/50 border rounded-xl overflow-x-auto font-mono text-[11px] leading-relaxed relative group">
          {lang && (
            <span className="absolute top-2 right-3 text-[9px] uppercase font-bold text-muted-foreground/60 select-none">
              {lang}
            </span>
          )}
          <code>{code}</code>
        </pre>
      );
    }

    const lines = part.split("\n");
    return (
      <div key={idx} className="space-y-2">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith("### ")) {
            return (
              <h3 key={lIdx} className="text-sm font-bold text-foreground mt-4 mb-2">
                {parseInline(trimmed.substring(4))}
              </h3>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2 key={lIdx} className="text-base font-bold text-foreground mt-5 mb-2.5 border-b pb-1">
                {parseInline(trimmed.substring(3))}
              </h2>
            );
          }
          if (trimmed.startsWith("# ")) {
            return (
              <h1 key={lIdx} className="text-lg font-black text-foreground mt-6 mb-3">
                {parseInline(trimmed.substring(2))}
              </h1>
            );
          }

          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <ul key={lIdx} className="list-disc pl-4 space-y-1">
                <li className="text-xs">{parseInline(trimmed.substring(2))}</li>
              </ul>
            );
          }

          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            return (
              <ol key={lIdx} className="list-decimal pl-4 space-y-1">
                <li className="text-xs">{parseInline(numMatch[2])}</li>
              </ol>
            );
          }

          return trimmed ? (
            <p key={lIdx} className="text-xs leading-relaxed mt-1">
              {parseInline(line)}
            </p>
          ) : (
            <div key={lIdx} className="h-2" />
          );
        })}
      </div>
    );
  });
}

function parseInline(inlineText: string): React.ReactNode[] {
  const tokens = inlineText.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={index} className="font-bold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return (
        <em key={index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded bg-muted/65 font-mono text-[10px] text-primary">
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}
