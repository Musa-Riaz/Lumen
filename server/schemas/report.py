from pydantic import BaseModel, Field
from typing import List

class SearchPlan(BaseModel):
    """Output of the search agent: a set of targetted web queries"""
    queries: List[str] = Field(
        description="3–5 specific web search queries to research the topic thoroughly.",
        min_items = 3,
        max_items = 5
    )
    reasoning: str = Field(
        description="Why these queries cover the topic well."
    )

class CriticVerdict(BaseModel):
    """Output of the Critic Agent"""
    passed: bool = Field(
        description="True if soruces are sufficient enough to write a good report."
    )
    feedback: str = Field(
        description="What's missing or what to search for next if not passed."
    )
    quality_score: float = Field(
        description="Overall source quality 0.0–1.0.", ge=0.0, le=1.0
    )

class ReportSection(BaseModel):
    heading: str
    content: str
    citation_indices: List[int] = Field(
        description="Which citation numbers support this section."
    )

class ResearchReport(BaseModel):
    """Final Strctured output of the writer agent"""
    title: str
    executive_summary: str = Field(description="3-4 sentence summary of key findings.")
    sections: List[ReportSection]
    key_takeaways: List[str] = Field(description="3-5 bullet point takeaways.")
    limitations: str = Field(description="What this report coudln't cover and why.")