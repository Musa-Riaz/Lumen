# Frontend SSE Streaming + Authentication

The client is a Next.js 16 / React 19 / Tailwind v4 / shadcn app. We need to:
1. Add user authentication so each user gets isolated research sessions
2. Wire up the SSE stream from the backend into the UI (progress feed + typewriter report)

---

## Recommended Auth: Clerk

**Why Clerk?**
- Fastest to set up — one `npm install`, two env vars, one middleware file, and you're done
- Provides hosted sign-in/sign-up UI out of the box (no forms to build)
- Free tier is generous (10k MAU)
- Works perfectly with Next.js App Router
- Gives you a `userId` on every server and client component with zero boilerplate

> [!NOTE]
> Alternatives: **NextAuth v5** (more DIY, needs a DB adapter), **Supabase Auth** (good if you're already on Supabase). Clerk wins on speed for this use case.

---

## Proposed Changes

### Auth — Clerk Setup

#### [NEW] `middleware.ts` (client root)
Clerk middleware that protects all routes except `/sign-in` and `/sign-up`. Redirects unauthenticated users to the sign-in page.

#### [MODIFY] [app/layout.tsx](file:///c:/Users/Home%20PC/OneDrive/Desktop/Lumen/client/app/layout.tsx)
Wrap the app in `<ClerkProvider>` so auth context is available everywhere.

#### [NEW] `app/sign-in/[[...sign-in]]/page.tsx`
Renders Clerk's hosted `<SignIn />` component — zero custom code.

#### [NEW] `app/sign-up/[[...sign-up]]/page.tsx`
Renders Clerk's hosted `<SignUp />` component — zero custom code.

---

### SSE Hook

#### [NEW] `lib/useResearch.ts`
A custom React hook that wraps the full SSE lifecycle:

```
POST /research/stream  →  EventSource-like fetch stream
```

Handles all 5 event types:
| Event | Action |
|-------|--------|
| `session` | Stores `session_id` in `localStorage` for resumption |
| `progress` | Appends message to a `steps[]` array |
| `token` | Appends token to a [report](file:///c:/Users/Home%20PC/OneDrive/Desktop/Lumen/server/agents/writer_agent.py#160-181) string (typewriter effect) |
| `done` | Sets `citations[]`, marks `isComplete = true` |
| `error` | Sets `error` string |

Returns: `{ startResearch, report, steps, citations, isLoading, isComplete, error }`

> [!IMPORTANT]
> SSE over `POST` can't use the native `EventSource` API (it only does GET). We use `fetch()` with `ReadableStream` instead, which works fine in modern browsers.

---

### Main Page

#### [MODIFY] [app/page.tsx](file:///c:/Users/Home%20PC/OneDrive/Desktop/Lumen/client/app/page.tsx)
The research chat page. Layout:
- Top bar with Clerk `<UserButton />` (avatar + sign-out dropdown)
- Centered input form (topic field + submit button)
- Left panel: progress steps feed (live during graph execution)
- Right/main panel: streaming markdown report with typewriter effect
- Bottom: clickable citation chips once `done` fires

---

## Verification Plan

### Manual Verification (no automated tests exist in this project)

1. **Auth flow**
   - Run `npm run dev` in `client/`
   - Visit `http://localhost:3000` → should redirect to `/sign-in`
   - Sign up with an email → should land on the home page
   - Sign out → should redirect back to `/sign-in`

2. **SSE streaming**
   - Sign in, enter a topic (e.g. "History of the internet"), click Submit
   - Progress steps should appear one by one within seconds
   - After steps, the report should render token by token (typewriter)
   - Once complete, source citation links should appear
   - Open DevTools → Network tab → `research/stream` → confirm it's a streaming response with `text/event-stream` content type

3. **Session persistence**
   - After a completed research, reload the page
   - The `session_id` from `localStorage` should be present
   - Submit the same topic → backend resumes from checkpoint (faster, fewer API calls)
