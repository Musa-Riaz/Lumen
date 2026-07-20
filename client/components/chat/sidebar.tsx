"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { Plus, Chat, Sun, Moon, CaretLeft, CaretRight, PencilSimple, Trash } from "@phosphor-icons/react";
import { useTheme } from "@/components/theme-provider";
import { Session } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onCreateSession: () => void;
  onRenameSession: (id: string, title: string) => Promise<boolean>;
  onDeleteSession: (id: string) => Promise<boolean>;
  loading: boolean;
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  loading,
}: SidebarProps) {
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const startRename = (id: string, currentTitle: string | null) => {
    setRenamingId(id);
    setRenameValue(currentTitle || "");
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      await onRenameSession(renamingId, trimmed);
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setRenamingId(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this session and all its messages?")) return;
    await onDeleteSession(id);
    // If the deleted session was active, clear the active session
    if (activeSessionId === id) {
      onSelectSession(null);
    }
  };

  return (
    <aside
      className={cn(
        "h-screen flex flex-col border-r bg-muted/30 transition-all duration-300 relative",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-4 -right-3 flex items-center justify-center w-6 h-6 rounded-full border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground z-50 cursor-pointer"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <CaretRight size={12} weight="bold" /> : <CaretLeft size={12} weight="bold" />}
      </button>

      {/* Header / Brand */}
      <div className={cn("p-4 flex items-center gap-3 border-b h-16", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg select-none">
              L
            </div>
            <div>
              <span className="font-semibold tracking-wide">Lumen</span>
              <span className="text-[10px] block text-muted-foreground uppercase tracking-widest font-bold -mt-1">
                Deep Research
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg select-none">
            L
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3">
        <button
          onClick={onCreateSession}
          className={cn(
            "w-full flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-dashed border-primary/30 text-xs font-semibold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all duration-200 cursor-pointer",
            collapsed && "px-0 w-10 mx-auto"
          )}
          title="New Research"
        >
          <Plus size={16} weight="bold" />
          {!collapsed && <span>New Research</span>}
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {loading && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {!collapsed && "Loading sessions..."}
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground/60 italic">
            {!collapsed && "No search history"}
          </div>
        )}
        {!loading &&
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isRenaming = renamingId === session.id;

            return (
              <div
                key={session.id}
                className={cn(
                  "group relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all duration-150",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  collapsed && "justify-center px-0 w-10 mx-auto"
                )}
              >
                {/* Session Button / Icon */}
                <button
                  onClick={() => onSelectSession(session.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer text-left"
                  title={session.title || "Unnamed research"}
                >
                  <Chat size={16} weight={isActive ? "fill" : "regular"} className="shrink-0" />
                  {!collapsed && !isRenaming && (
                    <span className="truncate select-none flex-1">
                      {session.title || "Untitled Research"}
                    </span>
                  )}
                </button>

                {/* Inline Rename Input */}
                {!collapsed && isRenaming && (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKeyDown}
                    className="flex-1 text-xs bg-background border border-primary/40 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                {/* Action Buttons (shown on hover when not collapsed or renaming) */}
                {!collapsed && !isRenaming && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(session.id, session.title);
                      }}
                      className="p-1 rounded-md hover:bg-background/60 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Rename session"
                    >
                      <PencilSimple size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Delete session"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer / User Settings */}
      <div className={cn("p-4 border-t flex items-center gap-3 bg-muted/10 shrink-0", collapsed ? "flex-col" : "justify-between")}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
            <UserButton />
          </div>
          {!collapsed && user && (
            <div className="max-w-30">
              <div className="font-semibold text-xs truncate leading-tight select-none">
                {user.fullName || user.username || "User"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate select-none">
                {user.primaryEmailAddress?.emailAddress}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </aside>
  );
}
