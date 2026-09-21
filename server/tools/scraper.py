from firecrawl import FirecrawlApp
from langchain_core.tools import tool
from dotenv import load_dotenv
import os

load_dotenv()

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
            formats=["markdown"]  # clean markdown, not raw HTML
        )
        
        if isinstance(result, dict):
            content = result.get("markdown", "")
            metadata = result.get("metadata", {})
            title = metadata.get("title", url) if isinstance(metadata, dict) else getattr(metadata, "title", url)
        else:
            content = getattr(result, "markdown", "") or ""
            metadata = getattr(result, "metadata", None)
            title = getattr(metadata, "title", url) if metadata else url

        return {
            "url": url,
            "title": title or url,
            "content": content,
        }
    except Exception as e:
        return {"url": url, "error": str(e), "content": ""}