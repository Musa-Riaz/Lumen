# Lumen — Autonomous AI Deep Research Assistant

**Lumen** is a state-of-the-art, autonomous AI deep research platform built to conduct comprehensive web investigations, synthesize multi-source intelligence, and stream structured research reports in real time.

Powered by a **LangGraph multi-agent architecture**, **Google Gemini 2.5 Flash**, **Tavily AI Search**, **Firecrawl Web Scraping**, **Neon Serverless PostgreSQL**, and a **Next.js 16 (React 19)** frontend, Lumen automates the entire research workflow—from initial query generation to source enrichment, quality evaluation, and live-streamed report synthesis.

---

## 🌟 Key Features

- 🧠 **Multi-Agent Research Pipeline**: Coordinated agent system featuring Search, Scraper/Enricher, Critic/Evaluator, and Writer agents managed by a Supervisor node.
- ⚡ **Real-Time Token & Event Streaming**: Server-Sent Events (SSE) stream live execution progress logs (search queries, scraped sources, critic feedback) and token-by-token report synthesis directly to the UI.
- 💬 **Smart Intent Classifier**: Gemini 2.5 Flash intent gate classifies queries upfront, bypassing the heavy multi-agent research graph for small talk and greetings to deliver instant response times.
- 🔄 **Fault-Tolerant Feedback Loops**: The Critic Agent grades source quality and forces query refinements if source depth is insufficient (with built-in max retry caps to prevent infinite loops).
- 💾 **Persistent Session Checkpointing**: Full research state is checkpointed to Neon PostgreSQL via `AsyncPostgresSaver`, allowing seamless session resumption, thread history browsing, and data persistence.
- 🔐 **Clerk Authentication Integration**: Secure user identification with client-server auth sync and internal API key middleware protecting backend endpoints.
- 🎨 **Modern Executive Dashboard**: Built with Next.js 16 App Router, React 19, Tailwind CSS v4, Lucide/Phosphor Icons, dark/light mode, and custom confirmation modals.

---

## 🏗 System Architecture

```
                                  +-------------------------------------------------+
                                  |                 NEXT.JS CLIENT                  |
                                  |  (React 19, Tailwind v4, Clerk Auth, Typewriter)|
                                  +------------------------+------------------------+
                                                           |
                                                HTTPS / SSE (Internal Key)
                                                           |
                                                           v
                                  +-------------------------------------------------+
                                  |                 FASTAPI BACKEND                 |
                                  |      (Session Router, Auth Sync, SSE Engine)    |
                                  +------------------------+------------------------+
                                                           |
                                                           v
                                  +-------------------------------------------------+
                                  |              INTENT CLASSIFIER                  |
                                  |         (Gemini 2.5 Flash Intent Router)        |
                                  +------------+-----------------------+------------+
                                               |                       |
                                     [CHITCHAT]|                       |[RESEARCH_TOPIC]
                                               v                       v
                                    +--------------------+   +----------------------+
                                    | Instant Response   |   | LANGGRAPH AGENT GRAPH|
                                    +--------------------+   +----------+-----------+
                                                                        |
                                               +------------------------+------------------------+
                                               |                        |                        |
                                               v                        v                        v
                                    +--------------------+   +--------------------+   +--------------------+
                                    |    Search Agent    |   |   Scraper Agent    |   |    Critic Agent    |
                                    |  (Tavily Search)   |   | (Firecrawl Scraping|   | (Quality Evaluator)|
                                    +---------+----------+   +---------+----------+   +---------+----------+
                                              |                        |                        |
                                              +------------------------+------------------------+
                                                                        |
                                                                        v (Critic Passed)
                                                             +--------------------+
                                                             |   Writer Agent     |
                                                             | (Streaming Gemini) |
                                                             +---------+----------+
                                                                       |
                                                                       v
                                                  +----------------------------------------+
                                                  |        NEON POSTGRESQL STORE           |
                                                  | (Users, Sessions, Messages, Checkpoints)|
                                                  +----------------------------------------+
```

---

## 📁 Repository Structure

```
Lumen/
├── client/                     # Next.js 16 Frontend Application
│   ├── app/                    # Next.js App Router (Pages & API Proxy Routes)
│   │   ├── api/                # Secure API route proxies (auth sync, research stream, sessions)
│   │   ├── sign-in/            # Clerk Sign-In Page
│   │   ├── sign-up/            # Clerk Sign-Up Page
│   │   ├── globals.css         # Tailwind CSS v4 design system & theme tokens
│   │   ├── layout.tsx          # Root Layout (ClerkProvider, ThemeProvider, Toaster)
│   │   └── page.tsx            # Main Chat & Research Interface
│   ├── components/             # UI & Chat Components
│   │   ├── chat/               # Sidebar, MessageFeed, InputArea, WelcomeSplash
│   │   ├── ui/                 # Reusable Radix/shadcn primitives (Dialog, Button, Tooltip)
│   │   ├── sync-user-client.tsx# Client-side user sync trigger
│   │   └── theme-provider.tsx  # Next-Themes provider
│   ├── lib/                    # Hooks & Utility functions
│   ├── proxy.ts                # Clerk middleware route protection
│   ├── package.json            # Frontend dependencies & scripts
│   └── README.md               # Client detailed README
│
├── server/                     # FastAPI Backend & LangGraph Engine
│   ├── agents/                 # Autonomous AI Agent Implementations
│   │   ├── search_agent.py     # Targeted search query generation & Tavily execution
│   │   ├── scraper_agent.py    # Deep source enrichment via Firecrawl
│   │   ├── critic_agent.py     # Source quality & completeness evaluation
│   │   ├── writer_agent.py     # Streaming report synthesis with inline citations
│   │   └── prompts.py          # System prompts for all agents
│   ├── api/                    # FastAPI Endpoints & DB Pool
│   │   ├── db.py               # Neon Postgres pool & table initialization
│   │   └── main.py             # Server endpoints & SSE event generator
│   ├── graph/                  # LangGraph Workflow Architecture
│   │   ├── graph.py            # Graph definition & AsyncPostgresSaver setup
│   │   ├── state.py            # AgentState TypedDict definition
│   │   └── supervisor.py       # Supervisor routing logic node
│   ├── schemas/                # Pydantic schemas (SearchPlan, CriticVerdict, Report)
│   ├── tools/                  # Tool abstractions (Tavily search, Firecrawl scraper)
│   ├── main.py                 # CLI test entrypoint
│   ├── pyproject.toml          # UV dependency configuration
│   ├── requirements.txt        # Python package requirements
│   └── README.md               # Server detailed README
│
└── README.md                   # Application Root README (This file)
```

---

## ⚡ Quickstart Guide

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v20.0.0` or higher
- **npm** or **pnpm**
- **Python**: `3.13` or higher (or `uv` package manager)
- **Neon PostgreSQL Database**: A serverless Postgres database URL
- **API Keys**:
  - Google Gemini API Key (`GOOGLE_API_KEY`)
  - Tavily Search API Key (`TAVILY_API_KEY`)
  - Firecrawl API Key (`FIRECRAWL_API_KEY`)
  - Clerk Authentication Keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)

---

### Step 1: Environment Setup

#### 1. Backend Environment (`server/.env`)
Create a `.env` file inside the `server/` directory:

```env
GOOGLE_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
NEON_DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
NEON_DATABASE_POOLING_URL=postgresql://user:password@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
INTERNAL_API_KEY=dev-secret-key
LANGSMITH_API_KEY=your_langsmith_api_key # Optional for tracing
LANGCHAIN_TRACING=true
```

#### 2. Frontend Environment (`client/.env.local`)
Create a `.env.local` file inside the `client/` directory:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

BACKEND_URL=http://localhost:8000
INTERNAL_API_KEY=dev-secret-key
```

---

### Step 2: Run the Application

#### Launch FastAPI Backend (Terminal 1)
```bash
cd server
# Install dependencies using uv or pip
pip install -r requirements.txt

# Start FastAPI server
uvicorn api.main:app --reload --port 8000
```
*The FastAPI server runs at `http://localhost:8000`.*

#### Launch Next.js Frontend (Terminal 2)
```bash
cd client
# Install dependencies
npm install

# Start development server
npm run dev
```
*The Next.js web application runs at `http://localhost:3000`.*

---

## 🔑 Environment Variables Reference

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `GOOGLE_API_KEY` | Server | Google Gemini 2.5 Flash API Key for intent classification & report generation. |
| `TAVILY_API_KEY` | Server | Tavily Search API Key for web searching. |
| `FIRECRAWL_API_KEY` | Server | Firecrawl API Key for full page markdown extraction. |
| `NEON_DATABASE_URL` | Server | Direct connection string for Neon PostgreSQL DB. |
| `NEON_DATABASE_POOLING_URL` | Server | Transaction pooler connection string for Neon DB connection pool. |
| `INTERNAL_API_KEY` | Both | Secret key shared between Next.js API proxy and FastAPI backend. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client | Public key for Clerk authentication on the frontend. |
| `CLERK_SECRET_KEY` | Client | Secret key for Clerk authentication on the server-side Next.js route handlers. |
| `BACKEND_URL` | Client | FastAPI server origin URL (default: `http://localhost:8000`). |

---

## 📜 Documentation Links

- 🖥️ **Client README**: [client/README.md](client/README.md) — Detailed Next.js UI structure, custom hooks, component specs, and API route proxies.
- ⚙️ **Server README**: [server/README.md](server/README.md) — Detailed FastAPI backend setup, LangGraph multi-agent architecture, database schema, and SSE event streaming specs.

---

## 🛠️ Stack & Technologies

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, Radix UI / shadcn, Lucide / Phosphor Icons, Sonner.
- **Backend**: FastAPI, LangGraph, LangChain Google GenAI (Gemini 2.5 Flash), Tavily AI, Firecrawl, Loguru, sse-starlette.
- **Database**: Neon Serverless PostgreSQL (`psycopg3` & `psycopg-pool`).
- **Auth**: Clerk Auth.

---

## 📄 License

This project is licensed under the MIT License.
