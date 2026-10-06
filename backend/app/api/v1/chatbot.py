from fastapi import APIRouter

from app.core.dependencies import ChatbotServiceDep, CurrentUser
from app.schemas.chatbot import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatbotStatusResponse,
    ConversationListItem,
    ConversationMessage,
)

router = APIRouter()


@router.get("/status", response_model=ChatbotStatusResponse)
async def chatbot_status(user: CurrentUser, service: ChatbotServiceDep):
    """Report whether Gemini is configured without exposing its API key."""
    return service.status()


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    user: CurrentUser,
    service: ChatbotServiceDep,
):
    return await service.process_message(
        user_id=user.id,
        message=request.message,
        conversation_id=request.conversation_id,
    )


@router.get("/conversations", response_model=list[ConversationListItem])
async def list_conversations(user: CurrentUser, service: ChatbotServiceDep):
    return await service.list_conversations(user.id)


@router.get(
    "/conversations/{conversation_id}",
    response_model=list[ConversationMessage],
)
async def get_conversation(
    conversation_id: str,
    user: CurrentUser,
    service: ChatbotServiceDep,
):
    return await service.get_conversation(user.id, conversation_id)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: CurrentUser,
    service: ChatbotServiceDep,
):
    await service.delete_conversation(user.id, conversation_id)
    return {"message": "Conversation deleted"}


@router.get("/suggestions")
async def get_suggestions(user: CurrentUser):
    return {
        "suggestions": [
            "How is our supply chain performing today?",
            "Which products are running low on stock?",
            "What are the current critical alerts?",
            "Show me supplier reliability rankings",
            "What does the AI recommend we do?",
            "What was the result of the last disruption simulation?",
        ]
    }
