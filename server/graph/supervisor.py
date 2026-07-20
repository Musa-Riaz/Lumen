from loguru import logger
from langgraph.types import Command 
from graph.state import AgentState

"""Supervisor node that decides whether to continue or stop the workflow."""

def supervisor_node(state: AgentState) -> Command:
    """Decide whether to continue or stop the workflow."""
    """
    Routing logic:
    1. If no search results yet → run search_agent
    2. If search done but no scraped sources → run scraper_agent  
    3. If scraped but not critic-checked → run critic_agent
    4. If critic failed → run search_agent again (retry with feedback)
    5. If critic passed → run writer_agent
    6. If report written → END
    """

    current_step = state.get("current_step", "start")
    critic_passed = state.get("critic_passed", None)
    final_report = state.get("final_report", None)
    raw_results = state.get("raw_search_results", [])
    scraped = state.get("scraped_sources", [])

    logger.info(f"Supervisor Node: current_step='{current_step}' | critic_passed={critic_passed} | raw_results={len(raw_results)} | scraped={len(scraped)}")

    # Routing decisions
    if final_report:
        logger.info("Supervisor Routing: -> END (final report compiled)")
        return Command(goto="__end__")

    if current_step == "start" or not raw_results:
        logger.info("Supervisor Routing: -> search_agent")
        return Command(goto="search_agent")

    if current_step == "search_agent":
        logger.info("Supervisor Routing: -> scraper_agent")
        return Command(goto="scraper_agent")

    if current_step == "scraper_agent":
        logger.info("Supervisor Routing: -> critic_agent")
        return Command(goto="critic_agent")

    if current_step == "critic_agent":
        if critic_passed:
            # Route to __end__ — writer is no longer part of the graph.
            # The SSE endpoint (api/main.py) calls stream_writer_agent() directly
            # after the graph finishes, which lets us stream each token to the
            # client in real time instead of waiting for a full JSON response.
            logger.info("Supervisor Routing: -> __end__ (writer will stream via SSE endpoint)")
            return Command(goto="__end__")
        else:
            logger.info("Supervisor Routing: -> search_agent (retrying search with critic feedback)")
            return Command(goto="search_agent")

    if current_step == "writer_agent":
        logger.info("Supervisor Routing: -> END")
        return Command(goto="__end__")

    # Fallback
    logger.warning("Supervisor Routing: fell back, routing -> END")
    return Command(goto="__end__")