from loguru import logger
from graph.state import AgentState, Source
from tools.scraper import scrape_url

MIN_CONTENT_LENGTH = 500   # chars — below this, try to scrape the full page

def scraper_agent(state: AgentState) -> dict:
    raw_results = state.get("raw_search_results", [])
    logger.info(f"Scraper Agent: processing {len(raw_results)} raw search results")

    progress = ["📄 Processing and enriching sources..."]
    sources: list[Source] = []

    for idx, result in enumerate(raw_results):
        if "error" in result:
            logger.warning(f"Scraper Agent: skipping search result #{idx+1} due to error: {result.get('error')}")
            continue

        content = result.get("content", "")
        url = result.get("url", "")
        title = result.get("title", url)

        logger.info(f"Scraper Agent: examining result #{idx+1} - Title: '{title[:40]}' - Length: {len(content)} chars")

        # If content is thin, try to scrape the full page
        if len(content) < MIN_CONTENT_LENGTH and url:
            logger.info(f"Scraper Agent: source content too thin ({len(content)} chars < {MIN_CONTENT_LENGTH}). Fetching full URL via Firecrawl: {url}")
            progress.append(f"   → Enriching thin source: {title[:60]}...")
            scraped = scrape_url.invoke({"url": url})
            if not scraped.get("error"):
                old_len = len(content)
                content = scraped.get("content", content)
                logger.info(f"Scraper Agent: enrichment successful! Size grew from {old_len} to {len(content)} chars")
            else:
                logger.warning(f"Scraper Agent: Firecrawl failed to scrape {url}. Error: {scraped.get('error')}")

        # Skip if still too thin (paywalled, JS-only, etc.)
        if len(content) < 200:
            msg = f"   ⚠ Skipped (insufficient content): {title[:60]}"
            progress.append(msg)
            logger.warning(f"Scraper Agent: content still too thin ({len(content)} chars). Skipping source.")
            continue

        sources.append(Source(
            url=url,
            title=title,
            content=content[:8000],   # cap at 8k chars to control context size
            relevance_score=result.get("score", 0.5),
        ))
        logger.info(f"Scraper Agent: successfully processed source: '{title[:40]}' (capped content size: {min(len(content), 8000)} chars)")

    msg = f"✅ Processed {len(sources)} quality sources"
    progress.append(msg)
    logger.info(msg)

    return {
        "scraped_sources": sources,   # uses operator.add — appends to existing
        "current_step": "scraper_agent",
        "progress_messages": progress,
    }