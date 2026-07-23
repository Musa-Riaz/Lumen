# Lumen Server — FastAPI & LangGraph Agent Engine

The **Lumen Server** is a high-performance Python backend built with **FastAPI**, **LangGraph**, **LangChain Google GenAI (Gemini 2.5 Flash)**, **Tavily AI**, **Firecrawl**, and **Neon Serverless PostgreSQL**. It orchestrates autonomous AI research agents, manages intent classification, maintains state checkpointing, and streams real-time execution events and synthesized reports over Server-Sent Events (SSE).

---

## ⚡ Key Features

- 🤖 **LangGraph Multi-Agent Engine**: Modular state graph orchestrating Supervisor, Search, Scraper, Critic, and Streaming Writer agents.
- 🎯 **Fast Intent Routing**: Built-in Gemini 2.5 Flash intent classifier routes greetings and conversational small talk ("CHITCHAT") around the heavy multi-agent research graph for sub-second response times.
- 🔁 **Refinement Feedback Loops**: Critic agent evaluates search source richness and relevance. If sources fall below quality thresholds, feedback is passed back to the Search agent to generate refined queries (capped at 2 retries).
- 💾 **Async Neon Postgres Checkpointer**: Uses `AsyncPostgresSaver` with `psycopg-pool` to store thread state snapshots, preventing data loss and enabling long-running research session resumption.
- 🌊 **Server-Sent Events (SSE)**: Streams step-by-step agent progress messages (`🔍 Generated queries...`, `📄 Scraped sources...`, `✅ Critic passed...`) and token-by-token report synthesis over an active HTTP SSE connection.
- 🔐 **Internal API Key Protection**: Secured by header-based authentication (`x-lumen-internal-key`) to ensure endpoints can only be accessed by the Next.js API proxy handler.

---

## 📁 Directory Structure

```
server/
├── agents/                     # AI Agent Implementations & Prompts
│   ├── critic_agent.py         # Evaluates source completeness & returns structured quality verdict
│   ├── prompts.py              # System prompts for search, critic, and streaming writer agents
│   ├── scraper_agent.py        # Processes raw search results & enriches thin content via Firecrawl
│   ├── search_agent.py         # Generates targeted search queries & executes Tavily web search
│   └── writer_agent.py         # Async generator streaming report tokens & formatting citations
│
├── api/                        # FastAPI Web Server & Database Pool
│   ├── db.py                   # Neon PostgreSQL connection pool & table setup SQL
│   └── main.py                 # FastAPI application, route handlers & SSE event generator
│
├── graph/                      # LangGraph Workflow Definition
│   ├── graph.py                # Graph construction & AsyncPostgresSaver setup
│   ├── state.py                # AgentState TypedDict definition
│   └── supervisor.py           # State transition router node
│
├── schemas/                    # Pydantic Schemas
│   └── report.py               # SearchPlan, CriticVerdict, ResearchReport models
│
├── tools/                      # Tool Definitions
│   ├── scraper.py              # Firecrawl scraping integration tool
│   └── search.py               # Tavily search integration tool
│
├── main.py                     # Standalone CLI testing script
├── pyproject.toml              # UV package metadata & dependency constraints
├── requirements.txt            # Python requirements file
└── README.md                   # Backend server documentation (This file)
```

---

## 🔄 Research Graph & Execution Workflow

### 1. State Definition (`AgentState`)

```python
class AgentState(TypedDict):
    topic: str
    search_queries: List[str]
    raw_search_results: List[dict]
    scraped_sources: Annotated[List[Source], operator.add]
    critic_feedback: Optional[str]
    critic_passed: Optional[bool]
    report_sections: List[dict]
    final_report: Optional[str]
    citations: Optional[List[dict]]
    current_step: str
    step_count: int
    progress_messages: Annotated[List[str], operator.add]
    error: Optional[str]
```

### 2. Multi-Agent Routing Graph

```
                   +------------------+
                   |     START        |
                   +--------+---------+
                            |
                            v
                   +------------------+
                   |    Supervisor    |
                   +--------+---------+
                            |
         +------------------+------------------+
         | (Step 1)         | (Step 2)         | (Step 3)
         v                  v                  v
+------------------+ +------------------+ +------------------+
|   Search Agent   | |  Scraper Agent   | |   Critic Agent   |
| (Tavily Search)  | | (Firecrawl App)  | |(Quality Evaluator|
+--------+---------+ +--------+---------+ +--------+---------+
         |                  |                  |
         +------------------+------------------+
                            |
                            v
                   +------------------+
                   |    Supervisor    |
                   +--------+---------+
                            |
                            | (Critic Passed / Max Retries)
                            v
                   +------------------+
                   |     __end__      |
                   +--------+---------+
                            |
                            v
                   +------------------+
                   | Stream Writer    |
                   | (SSE Endpoint)   |
                   +------------------+
```

---

## 🗄️ Database Architecture & Pooling

The server manages PostgreSQL database tables using `psycopg3` and `psycopg_pool.AsyncConnectionPool` tailored for Neon Serverless PostgreSQL:

### SQL Schema (`users`, `sessions`, `messages`)

```sql
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(255) PRIMARY KEY,        -- Clerk User ID (e.g. user_2abc...)
    email       VARCHAR(255) NOT NULL UNIQUE,
    first_name  VARCHAR(255),
    last_name   VARCHAR(255),
    image_url   TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    topic       TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,            -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    citations   JSONB DEFAULT '[]'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🌐 API Endpoint Reference

All protected endpoints require the HTTP header:
`x-lumen-internal-key: <INTERNAL_API_KEY>`

| Endpoint | Method | Security | Description |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Public | Server health check endpoint. |
| `/users/sync` | `POST` | Protected | Upserts Clerk user data into `users` table. |
| `/sessions` | `GET` | Protected | Returns list of sessions owned by `user_id`, ordered by date desc. |
| `/sessions` | `POST` | Protected | Creates a new session record and returns generated UUID. |
| `/sessions/{id}` | `PATCH` | Protected | Renames session title. |
| `/sessions/{id}` | `DELETE` | Protected | Deletes session record and cascades message deletions. |
| `/sessions/{id}/messages` | `GET` | Protected | Returns full message history for session in chronological order. |
| `/research/stream` | `POST` | Protected | Primary Server-Sent Events stream conducting research and streaming response. |

---

## 📡 Server-Sent Events (SSE) Protocol

The `POST /research/stream` endpoint streams real-time JSON payloads under standard SSE event headers:

```
event: session
data: {"session_id": "a3b8d1b6-0b3b-4b1a-9c1a-1a2b3c4d5e6f"}

event: progress
data: {"message": "🔍 Generated 3 search queries..."}

event: progress
data: {"message": "✅ Sources passed quality check (score: 0.88)"}

event: progress
data: {"message": "✍️ Writing report…"}

event: token
data: {"token": "### Executive Summary\n\nArtificial Intelligence..."}

event: done
data: {"status": "complete", "citations": [{"index": 1, "url": "https://...", "title": "..."}]}
```

---

## ⚙️ Configuration & Setup

Create a `.env` file in the `server/` directory:

```env
GOOGLE_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
NEON_DATABASE_URL=postgresql://neondb_owner:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
NEON_DATABASE_POOLING_URL=postgresql://neondb_owner:password@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
INTERNAL_API_KEY=dev-secret-key
LANGSMITH_API_KEY=your_langsmith_api_key # Optional
LANGCHAIN_TRACING=true
```

---

## 🏃 Running the Server

### Installation
Using `pip` or `uv`:
```bash
cd server
pip install -r requirements.txt
```

### Start FastAPI Server
```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Run Standalone CLI Graph Test
To test the LangGraph research pipeline directly in terminal:
```bash
python main.py
```
