# Lumen Client — Next.js 16 Web Application

The **Lumen Client** is a responsive, high-performance web interface built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **Clerk Authentication**. It provides an interactive AI research environment with real-time Server-Sent Events (SSE) streaming, typewriter text rendering, session management, dark/light theme switching, and live execution progress tracking.

---

## 🚀 Key Features

- 💻 **Real-Time Streaming UI**: Renders incoming token streams with a smooth typewriter queue algorithm to avoid UI stutter and latency during multi-paragraph report generation.
- ⚡ **Live Agent Execution Logs**: Displays real-time progress events broadcast by the LangGraph multi-agent engine (e.g., query generation, source deduplication, content enrichment, critic verification).
- 🗂️ **Thread & Session Management**: Create, view, rename, and delete research session threads. Deletions use modern interactive modal dialogs instead of raw browser popups.
- 🔒 **Clerk Auth & API Proxying**: Authenticates all requests on the frontend and proxies them securely through Next.js Route Handlers to the Python FastAPI backend using an internal API key header (`x-lumen-internal-key`).
- 🎨 **Executive Theme & Styling**: Styled with Tailwind CSS v4, CSS custom properties, Google Fonts (Geist Sans, Geist Mono, JetBrains Mono), Phosphor / Lucide icons, and sonner toasts.

---

## 📁 Directory Structure

```
client/
├── app/
│   ├── api/                            # Next.js Server-Side API Proxies
│   │   ├── auth/
│   │   │   └── sync/
│   │   │       └── route.ts            # POST: Syncs Clerk user data to FastAPI database
│   │   ├── research/
│   │   │   └── stream/
│   │   │       └── route.ts            # POST: Proxies SSE research stream from FastAPI
│   │   └── sessions/
│   │       ├── route.ts                # GET: List sessions | POST: Create session
│   │       └── [id]/
│   │           ├── route.ts            # PATCH: Rename session | DELETE: Delete session
│   │           └── messages/
│   │               └── route.ts        # GET: List session messages
│   ├── sign-in/[[...sign-in]]/         # Clerk Sign-In Page
│   ├── sign-up/[[...sign-up]]/         # Clerk Sign-Up Page
│   ├── favicon.ico                     # Application Favicon
│   ├── globals.css                     # Design tokens & Tailwind CSS v4 directives
│   ├── layout.tsx                      # Root Layout (Clerk, Theme, Toaster providers)
│   └── page.tsx                        # Main Interactive Research Interface & Controller
│
├── components/
│   ├── chat/
│   │   ├── input-area.tsx              # Controlled prompt input bar with stop/send controls
│   │   ├── message-feed.tsx            # Renders chat messages, agent progress, markdown & citations
│   │   ├── sidebar.tsx                 # Thread navigation drawer, rename/delete dialogs
│   │   └── welcome-splash.tsx          # Initial empty-state suggestions & hero banner
│   ├── ui/                             # Base UI & Radix primitives
│   │   ├── alert-dialog.tsx            # Custom confirmation modal
│   │   ├── dialog.tsx                  # Custom input edit modal
│   │   ├── button.tsx                  # Polymorphic button component
│   │   └── sonner.tsx                  # Toast notification container
│   ├── sync-user-client.tsx            # Client component triggering background user sync
│   └── theme-provider.tsx              # Dark / Light mode provider (next-themes)
│
├── lib/
│   ├── hooks.ts                        # Custom React hooks (useSessions, useMessages)
│   └── utils.ts                        # Classname merger helper (clsx + tailwind-merge)
│
├── proxy.ts                            # Clerk middleware route guardian
├── next.config.ts                      # Next.js configuration
├── tsconfig.json                       # TypeScript configuration
└── package.json                        # Frontend packages & execution scripts
```

---

## 🛠️ Tech Stack & Dependencies

- **Framework**: Next.js 16.2.10 (App Router)
- **UI Library**: React 19.2.4 & React DOM 19.2.4
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`), `clsx`, `tailwind-merge`
- **Authentication**: `@clerk/nextjs` (v7.5.20)
- **Icons**: `@phosphor-icons/react`
- **Notifications**: `sonner`
- **Theme**: `next-themes`

---

## 🔐 API Proxy Architecture

To keep the FastAPI backend securely isolated and maintain user privacy, the Next.js client acts as an API Proxy Gateway:

```
[Browser Client] ──> [Next.js Route Handler] ──(Add x-lumen-internal-key Header)──> [FastAPI Backend]
```

1. **Authentication Check**: Next.js API route handlers verify the active session via `auth()` from `@clerk/nextjs/server`. Unauthenticated requests return `401 Unauthorized` immediately.
2. **Backend Authentication**: Next.js injects the authenticated `userId` and attaches the `x-lumen-internal-key` header to all outbound requests to FastAPI.
3. **SSE Proxying**: The `/api/research/stream` handler receives the `ReadableStream` from FastAPI and pipes it directly to the browser with appropriate HTTP headers (`text/event-stream`).

---

## 💡 State Management & Hooks

### `useSessions()`
Manages session fetching, creation, renaming, and deletion.
- `fetchSessions()`: Retrieves all active chat sessions belonging to the authenticated user.
- `createSession(title, topic)`: Instantiates a new session row in the database.
- `renameSession(id, title)`: Performs inline session title update.
- `deleteSession(id)`: Removes a session thread and cascades deletion of its message history.

### `useMessages(sessionId)`
Fetches and maintains chronological chat history for the currently selected session thread.

### Typewriter Streaming Queue (`app/page.tsx`)
During research report generation:
1. Incoming SSE `token` events push text fragments into an `incomingBufferRef`.
2. A fixed 15ms interval timer drains the buffer dynamically into the `streamingContent` React state based on queue depth to prevent lagging or skipping.
3. Once the stream emits `done`, the final report and citations are persisted to the database and reloaded seamlessly into the thread message list.

---

## ⚙️ Setup & Environment Variables

Create `.env.local` inside the `client/` directory:

```env
# Clerk Authentication Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Route Redirects
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Backend API Service Settings
BACKEND_URL=http://localhost:8000
INTERNAL_API_KEY=dev-secret-key
```

---

## 🏃 Scripts & Commands

From inside the `client/` directory, run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server on `http://localhost:3000`. |
| `npm run build` | Compiles the production build for deployment. |
| `npm run start` | Launches the built production server. |
| `npm run lint` | Runs ESLint checks across the codebase. |

---

## 📜 Security & Middleware

Route protection is managed by `proxy.ts` (Clerk Middleware). All routes except `/sign-in`, `/sign-up`, and `/api/auth/*` require authentication. Unauthenticated users visiting protected routes are automatically redirected to the sign-in page.
