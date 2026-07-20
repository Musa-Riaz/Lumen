import asyncio
from loguru import logger
from graph.graph import research_graph
from graph.state import AgentState
import uuid



async def main():
    initial_state = AgentState(
        topic="Write me a report on the history of artificial intelligence, and its development throughout the years.",
        search_queries=[],
        raw_search_results=[],
        scraped_sources=[],
        critic_feedback=None,
        critic_passed=None,
        report_sections=[],
        final_report=None,
        citations=[],
        current_step="start",
        step_count=0,
        progress_messages=[],
        error=None,
    )


    result = await research_graph.ainvoke(initial_state)
    logger.info(result["final_report"])

    


if __name__ == "__main__":
    asyncio.run(main())

