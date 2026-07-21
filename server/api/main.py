import os
import uuid
import json
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from loguru import logger

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

from graph.state import AgentState
from graph.graph import get_checkpointed_graph
from agents.writer_agent import stream_writer_agent
from api.db import open_pool, close_pool, get_conn, init_db
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

load_dotenv()

INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev-secret-key")

# ---------------------------------------------------------------------------
# Lifespan – runs on startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await open_pool()
    await init_db()
    yield
    await close_pool()


app = FastAPI(title="Lumen API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Internal-key guard
# ---------------------------------------------------------------------------

async def verify_internal_key(x_lumen_internal_key: str = Header(...)):
    if x_lumen_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class ResearchRequest(BaseModel):
    topic: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    """
    Optional session identifier.

    • Pass the same session_id on subsequent requests to resume a previous
      research session — LangGraph will reload the checkpointed state from
      Neon and continue from where it left off.

    • Omit it (or pass null) to start a brand-new session.  The server will
      generate a fresh UUID and return it in the 'session' SSE event so the
      client can store it for later.
    """


class UserSyncRequest(BaseModel):
    id: str           # Clerk user ID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None


class CreateSessionRequest(BaseModel):
    user_id: str
    title: Optional[str] = "New Research Session"
    topic: Optional[str] = None


# ---------------------------------------------------------------------------
# User sync endpoint – called by the Next.js API route on sign-in
# ---------------------------------------------------------------------------

@app.post("/users/sync", dependencies=[Depends(verify_internal_key)])
async def sync_user(body: UserSyncRequest):
    """
    Upsert a Clerk user into the local `users` table.
    Called server-side from Next.js after every sign-in.
    """
    async with get_conn() as conn:
        await conn.execute(
            """
            INSERT INTO users (id, email, first_name, last_name, image_url)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE
                SET email      = EXCLUDED.email,
                    first_name = EXCLUDED.first_name,
                    last_name  = EXCLUDED.last_name,
                    image_url  = EXCLUDED.image_url
            """,
            (body.id, body.email, body.first_name, body.last_name, body.image_url),
        )
        await conn.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Session endpoints
# ---------------------------------------------------------------------------

@app.get("/sessions", dependencies=[Depends(verify_internal_key)])
async def list_sessions(user_id: str):
    """Return all sessions for a given user, ordered by creation time desc."""
    async with get_conn() as conn:
        rows = await conn.execute(
            "SELECT id, user_id, title, topic, created_at FROM sessions WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        )
        sessions = []
        async for row in rows:
            sessions.append({
                "id": str(row[0]),
                "user_id": row[1],
                "title": row[2],
                "topic": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
            })
    return {"sessions": sessions}


@app.post("/sessions", dependencies=[Depends(verify_internal_key)])
async def create_session(body: CreateSessionRequest):
    """Create a new session row and return its UUID."""
    session_id = str(uuid.uuid4())
    async with get_conn() as conn:
        await conn.execute(
            "INSERT INTO sessions (id, user_id, title, topic) VALUES (%s, %s, %s, %s)",
            (session_id, body.user_id, body.title, body.topic),
        )
        await conn.commit()
    return {"session_id": session_id}


class UpdateSessionRequest(BaseModel):
    title: str


@app.patch("/sessions/{session_id}", dependencies=[Depends(verify_internal_key)])
async def update_session(session_id: str, body: UpdateSessionRequest):
    """Update active session title name."""
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE sessions SET title = %s WHERE id = %s",
            (body.title, session_id),
        )
        await conn.commit()
    return {"status": "ok"}


@app.delete("/sessions/{session_id}", dependencies=[Depends(verify_internal_key)])
async def delete_session(session_id: str):
    """Delete a session (foreign keys ON DELETE CASCADE clean up messages automatically)."""
    async with get_conn() as conn:
        await conn.execute(
            "DELETE FROM sessions WHERE id = %s",
            (session_id,),
        )
        await conn.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Messages endpoint
# ---------------------------------------------------------------------------

@app.get("/sessions/{session_id}/messages", dependencies=[Depends(verify_internal_key)])
async def get_messages(session_id: str):
    """Return all messages for a session in chronological order."""
    async with get_conn() as conn:
        rows = await conn.execute(
            "SELECT id, session_id, role, content, citations, created_at FROM messages WHERE session_id = %s ORDER BY created_at ASC",
            (session_id,),
        )
        messages = []
        async for row in rows:
            messages.append({
                "id": str(row[0]),
                "session_id": str(row[1]),
                "role": row[2],
                "content": row[3],
                "citations": row[4] if row[4] else [],
                "created_at": row[5].isoformat() if row[5] else None,
            })
    return {"messages": messages}


# ---------------------------------------------------------------------------
# Streaming research endpoint
# ---------------------------------------------------------------------------

@app.post("/research/stream")
async def stream_research(
    request: ResearchRequest,
    x_lumen_internal_key: str = Header(...),
):
    if x_lumen_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")

    async def event_generator():

        # ------------------------------------------------------------------ #
        # Session ID                                                          #
        # ------------------------------------------------------------------ #
        session_id = request.session_id or str(uuid.uuid4())
        yield {
            "event": "session",
            "data": json.dumps({"session_id": session_id}),
        }
        await asyncio.sleep(0)

        # If we have a user_id, ensure the session row exists              #
        if request.user_id:
            async with get_conn() as conn:
                await conn.execute(
                    """
                    INSERT INTO sessions (id, user_id, title, topic)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (session_id, request.user_id, request.topic[:80] if request.topic else "New Session", request.topic),
                )
                await conn.commit()

        # LangGraph uses this config dict to key every checkpoint.
        langgraph_config = {"configurable": {"thread_id": session_id}}

        # Build the initial state for the graph
        initial_state = AgentState(
            topic=request.topic,
            search_queries=[],
            raw_search_results=[],
            scraped_sources=[],
            critic_feedback=None,
            critic_passed=False,
            report_sections=[],
            final_report=None,
            citations=[],
            current_step="start",
            step_count=0,
            progress_messages=[],
            error=None,
        )

        seen_messages: set[str] = set()
        accumulated_sources: list = []

        try:
            # -------------------------------------------------------------- #
            # Classifier: Bypasses Graph for greetings & conversation        #
            # -------------------------------------------------------------- #
            classify_prompt = (
                "You are an expert intent classifier for Lumen, an AI Deep Research Assistant.\n"
                "Your task is to classify the user's input topic/query into one of two categories:\n\n"
                "1. \"CHITCHAT\" - Select this if the input is small talk, a greeting, simple conversation, general politeness, "
                "or an out-of-scope discussion (e.g. \"hey\", \"how are you?\", \"tell me a joke\", \"what is your name?\", \"who created you?\").\n"
                "2. \"RESEARCH_TOPIC\" - Select this if the input is a request for detailed research, investigation, search queries, "
                "or compiling information on a specific subject.\n\n"
                "Respond with EXACTLY one word: either \"CHITCHAT\" or \"RESEARCH_TOPIC\". Do not include any other text, explanation or punctuation."
            )

            intent = "RESEARCH_TOPIC"
            try:
                intent_llm = ChatGoogleGenerativeAI(
                    model="gemini-2.5-flash",
                    temperature=0.0,
                    api_key=os.getenv("GOOGLE_API_KEY")
                )
                classification_resp = await intent_llm.ainvoke([
                    SystemMessage(content=classify_prompt),
                    HumanMessage(content=request.topic)
                ])
                raw_intent = classification_resp.content.strip().upper()
                if "CHITCHAT" in raw_intent:
                    intent = "CHITCHAT"
            except Exception as e:
                # Fallback to research topic if Ollama has a transient error
                logger.warning(f"Classification failed: {e}. Defaulting to RESEARCH_TOPIC.")

            final_report_tokens: list[str] = []
            final_citations: list = []

            if intent == "CHITCHAT":
                yield {
                    "event": "progress",
                    "data": json.dumps({"message": "💬 Responding..."}),
                }
                await asyncio.sleep(0)

                chitchat_llm = ChatGoogleGenerativeAI(
                    model="gemini-2.5-flash",
                    temperature=0.7,
                    api_key=os.getenv("GOOGLE_API_KEY")
                )
                chitchat_messages = [
                    SystemMessage(content=(
                        "You are Lumen, a polite AI Deep Research Assistant. Respond politely to the user's greeting or chitchat. "
                        "Keep the tone friendly and professional. Mention that you are optimized for structured web research, "
                        "and encourage them to ask a research query once they are ready. Keep your response brief (2-3 sentences)."
                    )),
                    HumanMessage(content=request.topic),
                ]
                async for chunk in chitchat_llm.astream(chitchat_messages):
                    token = chunk.content
                    if token:
                        final_report_tokens.append(token)
                        yield {
                            "event": "token",
                            "data": json.dumps({"token": token}),
                        }
                        await asyncio.sleep(0)
            else:
                # -------------------------------------------------------------- #
                # PHASE 1: Run the LangGraph pipeline with checkpointing          #
                # -------------------------------------------------------------- #
                async with get_checkpointed_graph() as graph:
                    async for state_snapshot in graph.astream(initial_state, config=langgraph_config):
                        for node_name, node_output in state_snapshot.items():
                            if not isinstance(node_output, dict):
                                continue

                            new_sources = node_output.get("scraped_sources", [])
                            if new_sources:
                                accumulated_sources.extend(new_sources)

                            for msg in node_output.get("progress_messages", []):
                                if msg not in seen_messages:
                                    seen_messages.add(msg)
                                    yield {
                                        "event": "progress",
                                        "data": json.dumps({"message": msg}),
                                    }
                                    await asyncio.sleep(0)

                # -------------------------------------------------------------- #
                # PHASE 2: Stream the writer's report output                     #
                # -------------------------------------------------------------- #
                yield {
                    "event": "progress",
                    "data": json.dumps({"message": "✍️ Writing report…"}),
                }
                await asyncio.sleep(0)

                writer_state = AgentState(
                    topic=request.topic,
                    search_queries=[],
                    raw_search_results=[],
                    scraped_sources=accumulated_sources,
                    critic_feedback=None,
                    critic_passed=True,
                    report_sections=[],
                    final_report=None,
                    citations=[],
                    current_step="writer_agent",
                    step_count=0,
                    progress_messages=[],
                    error=None,
                )

                async for token, citations in stream_writer_agent(writer_state):
                    final_citations = citations
                    final_report_tokens.append(token)
                    yield {
                        "event": "token",
                        "data": json.dumps({"token": token}),
                    }
                    await asyncio.sleep(0)

            # -------------------------------------------------------------- #
            # Persist user + assistant messages to DB                         #
            # -------------------------------------------------------------- #
            if request.user_id:
                final_report_text = "".join(final_report_tokens)
                async with get_conn() as conn:
                    await conn.execute(
                        "INSERT INTO messages (session_id, role, content, citations) VALUES (%s, %s, %s, %s)",
                        (session_id, "user", request.topic, json.dumps([])),
                    )
                    await conn.execute(
                        "INSERT INTO messages (session_id, role, content, citations) VALUES (%s, %s, %s, %s)",
                        (session_id, "assistant", final_report_text, json.dumps(final_citations)),
                    )
                    await conn.commit()

            yield {
                "event": "done",
                "data": json.dumps({
                    "status": "complete",
                    "citations": final_citations,
                }),
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e)}),
            }

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}