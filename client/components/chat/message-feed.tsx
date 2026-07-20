"use client";

import { Message } from "@/lib/hooks";
import { Sparkle, User, Link as LinkIcon, CircleNotch } from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";
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
  const feedEndRef = useRef<HTMLDivElement>(null);
  const [showProgressLog, setShowProgressLog] = useState(true);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, progressMessages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-6 md:px-8 max-w-4xl mx-auto w-full scrollbar-none">
      {messages.map((m) => (
        <div key={m.id} className="flex gap-4 items-start animate-fade-in">
          {/* Avatar */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-sm select-none",
              m.role === "user" ? "bg-accent border-accent text-foreground" : "bg-primary border-primary text-primary-foreground"
            )}
          >
            {m.role === "user" ? <User size={16} /> : <Sparkle size={16} weight="fill" />}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-3 min-w-0">
            <div className="font-semibold text-xs text-muted-foreground capitalize select-none">
              {m.role === "user" ? "You" : "Lumen AI"}
            </div>
            <div className="text-xs leading-relaxed text-foreground/90 space-y-3">
              {renderMarkdown(m.content)}
            </div>

            {/* Citations / Sources */}
            {m.role === "assistant" && m.citations && m.citations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-2 select-none">
                  Sources & Citations
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
      ))}

      {/* Streaming / Active Message */}
      {isStreaming && (
        <div className="space-y-6">
          {/* Main output element */}
          {streamingContent && (
            <div className="flex gap-4 items-start animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-primary border border-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm select-none">
                <Sparkle size={16} weight="fill" />
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div className="font-semibold text-xs text-muted-foreground select-none">
                  Lumen AI (Streaming...)
                </div>
                <div className="text-xs leading-relaxed text-foreground/90 space-y-3">
                  {renderMarkdown(streamingContent)}
                </div>
              </div>
            </div>
          )}

          {/* Agent execution log / progress box */}
          {progressMessages.length > 0 && (
            <div className="flex gap-4 items-start animate-fade-in pl-12">
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
      // Strip potential language specifier off first line
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

    // Inside normal blocks, process inline markers line by line
    const lines = part.split("\n");
    return (
      <div key={idx} className="space-y-2">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();

          // Headers
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

          // Bullet points
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <ul key={lIdx} className="list-disc pl-4 space-y-1">
                <li className="text-xs">{parseInline(trimmed.substring(2))}</li>
              </ul>
            );
          }

          // Numbered bullet points (e.g. "1. ")
          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            return (
              <ol key={lIdx} className="list-decimal pl-4 space-y-1">
                <li className="text-xs">{parseInline(numMatch[2])}</li>
              </ol>
            );
          }

          // Paragraph or empty line
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

// Custom inline parser for bold, italics, and inline code blocks
function parseInline(inlineText: string): React.ReactNode[] {
  // Regex to split on bold (**), italic (*), and inline code (`)
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
