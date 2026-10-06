from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    conversation_id: str | None = Field(
        None,
        max_length=255,
        description="Existing conversation ID, or null for a new conversation",
    )


class ChatSource(BaseModel):
    type: str = Field(description="Data source type: inventory, supplier, forecast, etc.")
    label: str = Field(description="Human-readable label")
    route: str | None = Field(None, description="Frontend route for deep-linking")


class ChatMessageResponse(BaseModel):
    conversation_id: str
    message_id: str
    answer: str = Field(description="Markdown-formatted response")
    sources: list[ChatSource] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)
    tool_calls_made: list[str] = Field(default_factory=list)
    assistant_mode: Literal["gemini", "fallback"] = "gemini"


class ChatbotStatusResponse(BaseModel):
    configured: bool
    provider: str
    model: str | None = None


class ConversationMessage(BaseModel):
    message_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ConversationListItem(BaseModel):
    conversation_id: str
    title: str
    message_count: int
    last_message_at: datetime
