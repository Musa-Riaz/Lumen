import os
from contextlib import asynccontextmanager
from langgraph.graph import START, StateGraph
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from graph.state import AgentState
from agents.search_agent import search_agent
from agents.scraper_agent import scraper_agent
from agents.critic_agent import critic_agent
from graph.supervisor import supervisor_node


# ---------------------------------------------------------------------------
# Graph definition
# ---------------------------------------------------------------------------
# NOTE: writer_agent is intentionally NOT a node in this graph.
# After the critic passes, the supervisor routes to __end__ and the SSE
# endpoint (api/main.py) calls stream_writer_agent() directly so LLM tokens
# can be forwarded to the client one by one.
# ---------------------------------------------------------------------------


def _build_graph_definition() -> StateGraph:
    """
    Build and return the compiled StateGraph *without* a checkpointer attached.
    A checkpointer is injected at compile time via get_checkpointed_graph().
    """
    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("search_agent", search_agent)
    graph.add_node("scraper_agent", scraper_agent)
    graph.add_node("critic_agent", critic_agent)

    # All agents hand control back to the supervisor after running so it can
    # decide the next step (retry search, scrape, critic, or end).
    graph.add_edge(START, "supervisor")
    graph.add_edge("search_agent", "supervisor")
    graph.add_edge("scraper_agent", "supervisor")
    graph.add_edge("critic_agent", "supervisor")

    return graph


@asynccontextmanager
async def get_checkpointed_graph():

    """
    Async context manager that yields a compiled research graph wired up to
    the Neon PostgreSQL checkpointer.

    How it works:
    ------------
    1.  AsyncPostgresSaver opens an async connection pool to your Neon DB.
    2.  .setup() creates the LangGraph checkpoint tables if they don't exist yet
        (idempotent — safe to call on every startup).
    3.  The graph is compiled with the checkpointer so every state transition
        is automatically persisted under the supplied thread_id.
    4.  When the `async with` block exits the connection pool is closed cleanly.

    Why async?
    ----------
    Neon requires SSL and the psycopg3 async driver.  The synchronous
    PostgresSaver won't work reliably with Neon's connection pooler.
    """
    db_url = os.environ.get("NEON_DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "NEON_DATABASE_URL is not set. "
            "Add it to your .env file as a standard libpq connection string, e.g.:\n"
        )

    # AsyncPostgresSaver is used as an async context manager so the underlying
    # connection pool is properly torn down after the request finishes.
    async with AsyncPostgresSaver.from_conn_string(db_url) as checkpointer:
        # Create checkpoint tables on first run (no-op afterwards)
        await checkpointer.setup()

        # Compile the graph with the checkpointer injected
        graph_def = _build_graph_definition()
        compiled = graph_def.compile(checkpointer=checkpointer)

        try:
            print(compiled.get_graph().draw_ascii())
        except Exception:
            pass  # ASCII drawing is optional / cosmetic

        yield compiled


# ---------------------------------------------------------------------------
# Non-persistent fallback (used for health checks / local dev without DB)
# ---------------------------------------------------------------------------

def build_graph_no_checkpointer():
    """
    Compile the graph WITHOUT a checkpointer.
    Useful for local development when you don't have a Neon DB configured,
    or for one-off runs where session persistence isn't needed.
    """
    graph_def = _build_graph_definition()
    compiled = graph_def.compile()
    try:
        print(compiled.get_graph().draw_ascii())
    except Exception:
        pass
    return compiled
