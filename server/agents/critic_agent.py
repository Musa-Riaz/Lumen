from loguru import logger
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from graph.state import AgentState
from schemas.report import CriticVerdict
from agents.prompts import CRITIC_PROMPT
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
    api_key=os.getenv("GOOGLE_API_KEY")
)

def critic_agent(state: AgentState) -> dict:
    topic = state['topic']
    sources = state.get("scraped_sources", [])
    step_count = state.get("step_count", 0)

    logger.info(f"Critic Agent: starting evaluation of {len(sources)} sources (pass #{step_count + 1}) for topic='{topic}'")

    progress = [f"Critic evaluating {len(sources)} sources (pass #{step_count + 1} ...)"]

    # Force pass if we've already retried twice — avoid infinite loops
    if step_count >= 2:
        msg = "   → Max retries reached, proceeding with available sources"
        progress.append(msg)
        logger.warning(f"Critic Agent: max retries ({step_count}) reached. Automatically forcing pass despite source quality.")
        return {
            "critic_passed": True,
            "critic_feedback": "",
            "step_count": step_count + 1,
            "current_step": "critic_agent",
            "progress_messages": progress,
        }

    # Build a summary of what we have for the critic to grade
    source_summary = "\n\n".join([
        f"Source {i+1}: {s['title']}\nURL: {s['url']}\nContent preview: {s['content'][:600]}..."
        for i, s in enumerate(sources[:10])
    ])

    logger.info("Critic Agent: sending prompt to judge quality score")
    critic = llm.with_structured_output(CriticVerdict, method="json_mode")
    verdict: CriticVerdict = critic.invoke([
        SystemMessage(content=CRITIC_PROMPT),
        HumanMessage(content=f"Topic: {topic}\n\nSources collected:\n{source_summary}")
    ])

    logger.info(f"Critic Agent: verdict.passed={verdict.passed} | quality_score={verdict.quality_score} | feedback='{verdict.feedback}'")

    if verdict.passed: 
        msg = f"✅ Sources passed quality check (score: {verdict.quality_score:.2f})"
        progress.append(msg)
        logger.info(f"Critic Agent: sources PASSED quality thresholds.")
    else:
        msg = f"❌ Sources insufficient (score: {verdict.quality_score:.2f})"
        progress.append(msg)
        progress.append(f"→ Feedback: {verdict.feedback}")
        logger.warning(f"Critic Agent: sources FAILED quality checks. Feedback: '{verdict.feedback}'")

    return {
        "critic_passed": verdict.passed,
        "critic_feedback": verdict.feedback,
        "step_count": step_count + 1,
        "current_step": "critic_agent",
        "progress_messages": progress
    }
