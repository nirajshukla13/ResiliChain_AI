from datetime import datetime
from pydantic import BaseModel, Field

class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User message")
    conversation_id: str | None = Field(None, description="Existing conversation ID, or null for new")

class ChatSource(BaseModel):
    type: str = Field(description="Data source type: inventory, supplier, forecast, etc.")
    label: str = Field(description="Human-readable label")
    route: str | None = Field(None, description="Frontend route for deep-linking")

class ChatMessageResponse(BaseModel):
    conversation_id: str
    message_id: str
    answer: str = Field(description="Markdown-formatted response")
    sources: list[ChatSource] = []
    suggested_followups: list[str] = []
    tool_calls_made: list[str] = []

class ConversationListItem(BaseModel):
    conversation_id: str
    title: str
    message_count: int
    last_message_at: datetime
