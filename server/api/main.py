import os
import uuid
import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv
from graph.state import AgentState
from graph.graph import get_checkpointed_graph
from agents.writer_agent import stream_writer_agent

load_dotenv()

app = FastAPI(title="Lumen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class ResearchRequest(BaseModel):
    topic: str
    session_id: str | None = None
    """
    Optional session identifier.

    • Pass the same session_id on subsequent requests to resume a previous
      research session — LangGraph will reload the checkpointed state from
      Neon and continue from where it left off.

    • Omit it (or pass null) to start a brand-new session.  The server will
      generate a fresh UUID and return it in the 'session' SSE event so the
      client can store it for later.
    """


# ---------------------------------------------------------------------------
# Streaming research endpoint
# ---------------------------------------------------------------------------

@app.post("/research/stream")
async def stream_research(request: ResearchRequest):
    """
    Streams a full research pipeline as Server-Sent Events.

    Session / checkpointing
    -----------------------
    Every run is tied to a thread_id (= session_id) which is stored as a
    LangGraph checkpoint in Neon.  The client can replay or resume any
    previous session by sending its session_id.

    SSE event types emitted:
      • session   → { session_id: str }        — sent first so client can store it
      • progress  → { message: str }           — pipeline status updates
      • token     → { token: str }             — individual LLM output tokens
      • done      → { status, citations[] }    — signals completion with sources
      • error     → { message: str }           — unhandled exceptions
    """
    async def event_generator():

        # ------------------------------------------------------------------ #
        # Session ID                                                          #
        #                                                                     #
        # Use the client-supplied ID or generate a new UUID.                 #
        # Emit it immediately so the frontend can persist it (e.g. in        #
        # localStorage) before any work starts.                               #
        # ------------------------------------------------------------------ #
        session_id = request.session_id or str(uuid.uuid4())
        yield {
            "event": "session",
            "data": json.dumps({"session_id": session_id}),
        }
        await asyncio.sleep(0)

        # LangGraph uses this config dict to key every checkpoint.
        # thread_id is the only required field for the Postgres checkpointer.
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

        # Track which progress messages have already been emitted so we
        # never send a duplicate during a retry loop.
        seen_messages: set[str] = set()

        # Accumulate scraped_sources across all node outputs so we have the
        # full list ready for the writer after the graph ends.
        accumulated_sources: list = []

        try:
            # -------------------------------------------------------------- #
            # PHASE 1: Run the LangGraph pipeline with checkpointing          #
            #                                                                 #
            # get_checkpointed_graph() is an async context manager that:      #
            #   1. Opens an async psycopg3 pool to Neon                       #
            #   2. Runs checkpointer.setup() (creates tables if needed)       #
            #   3. Compiles the graph with AsyncPostgresSaver attached         #
            #   4. Yields the compiled graph                                  #
            #   5. Closes the pool when the `async with` block exits          #
            #                                                                 #
            # Passing langgraph_config to astream() tells the checkpointer   #
            # which thread (session) to read/write state for.                 #
            # -------------------------------------------------------------- #
            async with get_checkpointed_graph() as graph:
                async for state_snapshot in graph.astream(initial_state, config=langgraph_config):
                    # state_snapshot → { node_name: partial_state_dict }
                    for node_name, node_output in state_snapshot.items():
                        if not isinstance(node_output, dict):
                            continue

                        # Merge scraped sources from each node into our list
                        new_sources = node_output.get("scraped_sources", [])
                        if new_sources:
                            accumulated_sources.extend(new_sources)

                        # Emit new progress messages as they arrive
                        for msg in node_output.get("progress_messages", []):
                            if msg not in seen_messages:
                                seen_messages.add(msg)
                                yield {
                                    "event": "progress",
                                    "data": json.dumps({"message": msg}),
                                }
                                # Flush to client immediately
                                await asyncio.sleep(0)

            # -------------------------------------------------------------- #
            # PHASE 2: Stream the writer's output token by token              #
            #                                                                 #
            # The graph has now ended (critic passed or max retries hit).     #
            # We call stream_writer_agent() which uses plain .astream() on    #
            # the LLM — no structured output, so each token arrives directly. #
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

            final_citations: list = []
            async for token, citations in stream_writer_agent(writer_state):
                # citations is the same list on every iteration; grab last ref
                final_citations = citations
                yield {
                    "event": "token",
                    "data": json.dumps({"token": token}),
                }
                # Yield control after every token so the event loop can push
                # the chunk without waiting for the next one.
                await asyncio.sleep(0)

            # -------------------------------------------------------------- #
            # Signal completion — include citations so the frontend can        #
            # render clickable source links below the report.                  #
            # -------------------------------------------------------------- #
            yield {
                "event": "done",
                "data": json.dumps({
                    "status": "complete",
                    "citations": final_citations,
                }),
            }

        except Exception as e:
            # Structured error event so the frontend can display a message
            # rather than silently dying on a broken stream.
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