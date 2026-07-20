from loguru import logger
from typing import AsyncGenerator, Tuple
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from graph.state import AgentState
from agents.prompts import WRITER_PROMPT, STREAMING_WRITER_PROMPT


# ---------------------------------------------------------------------------
# Synchronous LLM (structured output) — kept for potential offline / batch use
# but NO longer called from the graph. The streaming version below is used
# by the SSE endpoint instead so the user can see tokens arrive in real time.
# ---------------------------------------------------------------------------
llm = ChatOllama(
    model="gemma4:31b-cloud",
    temperature=0.4,
    max_tokens=8192
)


# ---------------------------------------------------------------------------
# Streaming writer
# ---------------------------------------------------------------------------

def _build_citations(sources: list) -> list:
    """
    Build a list of citation dicts from scraped sources.
    Each dict has: index (1-based), url, title.
    """
    return [
        {"index": i + 1, "url": s["url"], "title": s["title"]}
        for i, s in enumerate(sources)
    ]


def _build_formatted_sources(sources: list) -> str:
    """
    Format scraped sources into a numbered block that the LLM can read.
    The citation numbers here match the citation index list above so the
    LLM can write [1], [2] … markers that the frontend can hyperlink.
    """
    return "\n\n---\n\n".join([
        f"[{i+1}] {s['title']}\nURL: {s['url']}\n\n{s['content']}"
        for i, s in enumerate(sources)
    ])


async def stream_writer_agent(
    state: AgentState,
) -> AsyncGenerator[Tuple[str, list], None]:
    """
    Async generator that streams the final research report token by token.

    Yields
    ------
    (token: str, citations: list)
        token    – a single text chunk straight from the LLM
        citations – the full citation list (same on every yield so the
                    caller always has it available at the end)

    Why a plain LLM instead of with_structured_output?
    ---------------------------------------------------
    `with_structured_output(..., method="json_mode")` buffers the entire
    response before parsing it as JSON.  There is no way to stream
    individual tokens out of that pipeline.  Here we use a plain ChatOllama
    with `.astream()` which hands us each chunk as the model produces it.
    The trade-off is that we write a markdown-first prompt rather than
    relying on Pydantic validation — the output is already presentable
    markdown so no conversion step is needed.
    """
    topic = state["topic"]
    sources = state.get("scraped_sources", [])

    logger.info(
        f"stream_writer_agent: starting token stream for topic='{topic}' "
        f"with {len(sources)} sources"
    )

    # Build citations once — reused on every yield
    citations = _build_citations(sources)
    formatted_sources = _build_formatted_sources(sources)

    # Streaming LLM — no structured output so `.astream()` works
    streaming_llm = ChatOllama(
        model="gemma4:31b-cloud",
        temperature=0.4,
        # No max_tokens cap here so the full report can be written
    )

    messages = [
        SystemMessage(content=STREAMING_WRITER_PROMPT),
        HumanMessage(content=f"""
Topic: {topic}

Sources (cite them inline using [1], [2] … numbers):
{formatted_sources}

Write a comprehensive research report in clean Markdown with 4–6 sections
covering the most important aspects of this topic.
"""),
    ]

    # Stream tokens — each `chunk` is an AIMessageChunk
    async for chunk in streaming_llm.astream(messages):
        token: str = chunk.content  # type: ignore[assignment]
        if token:  # skip empty heartbeat chunks
            yield token, citations

    logger.info("stream_writer_agent: token stream complete")


# ---------------------------------------------------------------------------
# Legacy synchronous writer (no longer wired into the graph, but kept here
# in case you want to fall back to a batch / non-streaming flow later).
# ---------------------------------------------------------------------------

def writer_agent(state: AgentState) -> dict:
    """
    Synchronous batch writer.  NOT called from the LangGraph graph anymore —
    the graph now ends after the critic passes and the streaming SSE endpoint
    takes over.  Kept for reference / offline use.
    """
    from schemas.report import ResearchReport  # local import to avoid circular

    topic = state["topic"]
    sources = state.get("scraped_sources", [])

    logger.info(
        f"writer_agent (batch): compiling report for topic='{topic}' "
        f"using {len(sources)} sources"
    )

    citations = _build_citations(sources)
    formatted_sources = _build_formatted_sources(sources)

    writer = llm.with_structured_output(ResearchReport, method="json_mode")
    report: ResearchReport = writer.invoke([
        SystemMessage(content=WRITER_PROMPT),
        HumanMessage(content=f"""
Topic: {topic}

Sources (cite them by number):
{formatted_sources}

Write a comprehensive research report with 4–6 sections.
"""),
    ])

    markdown = _report_to_markdown(report, citations)

    return {
        "report_sections": [s.model_dump() for s in report.sections],
        "final_report": markdown,
        "citations": citations,
        "current_step": "writer_agent",
        "progress_messages": [f"Writer composing report for topic: {topic}", "✅ Report written successfully"],
    }


def _report_to_markdown(report, citations: list) -> str:
    """Convert a structured ResearchReport Pydantic object to clean Markdown."""
    lines = [
        f"# {report.title}\n",
        f"## Executive Summary\n\n{report.executive_summary}\n",
    ]

    for section in report.sections:
        lines.append(f"## {section.heading}\n\n{section.content}\n")

    lines.append("## Key Takeaways\n")
    for point in report.key_takeaways:
        lines.append(f"- {point}")

    lines.append(f"\n## Limitations\n\n{report.limitations}\n")

    lines.append("\n## Sources\n")
    for c in citations:
        lines.append(f"[{c['index']}] [{c['title']}]({c['url']})")

    return "\n".join(lines)