from firecrawl import FirecrawlApp
from langchain_core.tools import tool
import os

app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))

@tool
def scrape_url(url: str) -> dict:
    """
    Scrape the full content of a specific URL.
    Use this when search results don't contain enough detail on a source.
    Returns the page title and full markdown content.
    """
    try:
        result = app.scrape_url(
            url,
            params={"formats": ["markdown"]}  # clean markdown, not raw HTML
        )
        return {
            "url": url,
            "title": result.get("metadata", {}).get("title", url),
            "content": result.get("markdown", ""),
        }
    except Exception as e:
        return {"url": url, "error": str(e), "content": ""}