"use client";

import { PaperPlaneRight, CircleNotch, Stop } from "@phosphor-icons/react";
import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface InputAreaProps {
  value: string;
  onChange: (val: string) => void;
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean; // representing isStreaming
}

export function InputArea({ value, onChange, onSend, onStop, disabled }: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Self-resizing logic for textarea based on value
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate properly
    textarea.style.height = "auto";
    // Set to scrollHeight but clamp it at 200px
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) {
      // Act as a stop button click
      if (onStop) onStop();
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t bg-background shrink-0 pb-6 pt-4 px-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
        <div className="relative flex items-end w-full rounded-2xl border bg-muted/20 focus-within:border-primary/45 focus-within:ring-1 focus-within:ring-primary/45 transition-colors overflow-hidden pr-12 pl-4 py-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Research is active, please wait..." : "Ask Lumen to search and compile deep research..."}
            disabled={disabled}
            className="w-full resize-none bg-transparent border-0 ring-0 focus:ring-0 focus:outline-none text-xs font-mono placeholder:text-muted-foreground/60 min-h-6 max-h-50 leading-relaxed py-1"
          />

          <button
            type="submit"
            className={cn(
              "absolute right-3 bottom-2.5 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 cursor-pointer shadow-sm select-none",
              disabled
                ? "bg-destructive text-destructive-foreground hover:opacity-90 hover:scale-105"
                : value.trim()
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed border"
            )}
            aria-label={disabled ? "Stop generating" : "Send message"}
          >
            {disabled ? (
              <Stop size={14} weight="fill" className="animate-pulse" />
            ) : (
              <PaperPlaneRight size={14} weight="bold" />
            )}
          </button>
        </div>

        {/* Informative Subtext */}
        <p className="text-[10px] text-muted-foreground/60 text-center mt-2.5 select-none font-mono">
          Lumen streams details dynamically. Search queries, scrape runs, and critiques are verified as we run.
        </p>
      </form>
    </div>
  );
}
