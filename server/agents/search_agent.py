from loguru import logger
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from graph.state import AgentState
from schemas.report import SearchPlan
from tools.search import search_web
from agents.prompts import SEARCH_AGENT_PROMPT

llm = ChatOllama(
    model="gemma4:31b-cloud",
    temperature=0
)

"""Generates smart search queries, then runs them using the Tavily tool."""



def search_agent(state: AgentState) -> dict:
    topic = state["topic"]
    critic_feedback = state.get("critic_feedback", "")
    
    logger.info(f"Search Agent: starting query generation for topic='{topic}'")
    if critic_feedback:
        logger.info(f"Search Agent: incorporating critic feedback: '{critic_feedback}'")

    # Step 1: Generate targetted queries
    planner = llm.with_structured_output(SearchPlan, method="json_mode")

    feedback_context = f"\n\nPrevious research was insufficient. Critic feedback: {critic_feedback}\nAddress these gaps specifically."

    plan: SearchPlan = planner.invoke([
        SystemMessage(content=SEARCH_AGENT_PROMPT),
        HumanMessage(content=f"Topic: {topic}{feedback_context}")
    ])

    logger.info(f"Search Agent: generated {len(plan.queries)} queries. Reasoning: {plan.reasoning}")
    for i, q in enumerate(plan.queries):
        logger.info(f"   Query #{i+1}: {q}")

    progress = [f"🔍 Generated {len(plan.queries)} search queries..."]

    # Step 2: Execute searches
    all_results = []
    for query in plan.queries:
        logger.info(f"Search Agent: running Tavily search for: '{query}'")
        results = search_web.invoke({"query": query, "max_results": 4})
        all_results.extend(results)
        msg = f"   → Searched: '{query}' — found {len(results)} results"
        progress.append(msg)
        logger.info(msg)

    #Deduplicate by url
    seen_urls = set()
    unique_results = []
    for r in all_results:
        url = r.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_results.append(r)

    msg = f"✅ Found {len(unique_results)} unique sources (deduplicated from {len(all_results)} total)"
    progress.append(msg)
    logger.info(msg)

    return {
        "search_queries": plan.queries,
        "raw_search_results": unique_results,
        "current_step": "search_agent",
        "progress_messages": progress,
    }
