from tavily import TavilyClient
from langchain_core.tools import tool
from dotenv import load_dotenv
import os

load_dotenv()
tavily_client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


@tool
def search_web(query: str, max_results: int=6) -> list[dict]:
    """
    Search the web for current information on a topic
    Returns a list of results, with content, url, title and content snippet
    Use specific, targetted quries for better result 
    """
    try:
        res = tavily_client.search(
            query=query,
            max_results=max_results,
            search_depth="advanced",
            include_raw_content=True
        )
        return [
            {
                "title":r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("raw_content") or r.get("content", ""),
                "score": r.get("score", 0.0)
            }
            for r in res.get("results", [])
        ]
    except Exception as e:
        print(f"Error searching web: {e}")
        return [{
            "error": str(e)
        }]