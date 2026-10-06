"""Gemini-backed conversational assistant with live ResiliChain data tools."""

import json
import logging
import uuid
from typing import Any, Literal

from google import genai
from google.genai import types
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chat_message import ChatMessage
from app.schemas.chatbot import (
    ChatMessageResponse,
    ChatSource,
    ChatbotStatusResponse,
    ConversationListItem,
    ConversationMessage,
)
from app.services.alert_service import AlertService
from app.services.chatbot_tools import TOOL_DEFINITIONS, execute_tool
from app.services.dashboard_service import DashboardService
from app.services.forecast_service import ForecastService
from app.services.inventory_service import InventoryService
from app.services.recommendation_service import RecommendationService
from app.services.simulation_service import SimulationService
from app.services.supplier_service import SupplierService
from app.services.warehouse_service import WarehouseService
from app.utils.exceptions import NotFoundError

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are ResiliChain AI, an intelligent supply chain assistant.
Help managers understand their dashboard, inventory, suppliers, warehouses, disruptions, forecasts, and recommendations.
Be concise, analytical, and professional. Use markdown and explain important figures in plain language.
You can query live application data using the supplied functions. Use them when the question depends on current data; never invent figures.
If a data tool reports an error, acknowledge that the data could not be retrieved rather than guessing.
Offer a practical next step when useful. The forecast tool may save a forecast run, and the recommendations tool may save generated recommendations; no tool changes operational inventory, supplier, or warehouse records. Be clear when one of those analysis actions is run.
"""


class ChatbotService:
    def __init__(
        self,
        db: AsyncSession,
        dashboard: DashboardService,
        inventory: InventoryService,
        supplier: SupplierService,
        warehouse: WarehouseService,
        forecast: ForecastService,
        alert: AlertService,
        recommendation: RecommendationService,
        simulation: SimulationService,
    ) -> None:
        self.db = db
        self.services_map = {
            "dashboard_service": dashboard,
            "inventory_service": inventory,
            "supplier_service": supplier,
            "warehouse_service": warehouse,
            "forecast_service": forecast,
            "alert_service": alert,
            "recommendation_service": recommendation,
            "simulation_service": simulation,
        }

    def status(self) -> ChatbotStatusResponse:
        """Return non-secret configuration details for the client status chip."""
        configured = settings.CHATBOT_ENABLED and bool(settings.GEMINI_API_KEY.strip())
        return ChatbotStatusResponse(
            configured=configured,
            provider="Google Gemini" if configured else "Live data mode",
            model=settings.GEMINI_MODEL if configured else None,
        )

    async def _get_history(
        self, user_id: uuid.UUID, conversation_id: str
    ) -> list[types.Content]:
        """Load the most recent user-owned turns in chronological order."""
        history_size = max(settings.CHATBOT_MAX_HISTORY, 0)
        if not history_size:
            return []

        stmt = (
            select(ChatMessage)
            .where(
                ChatMessage.user_id == user_id,
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.role.in_(("user", "assistant")),
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(history_size)
        )
        result = await self.db.execute(stmt)
        messages = list(reversed(result.scalars().all()))

        return [
            types.Content(
                role="user" if message.role == "user" else "model",
                parts=[types.Part(text=message.content)],
            )
            for message in messages
            if message.content
        ]

    async def _generate_gemini_answer(
        self,
        history: list[types.Content],
        message: str,
        user_id: uuid.UUID,
        conversation_id: str,
        sources: list[ChatSource],
        tools_called: list[str],
    ) -> str:
        """Ask Gemini, execute any requested read tools, and return its answer."""
        contents = [
            *history,
            types.Content(role="user", parts=[types.Part(text=message)]),
        ]
        declarations = [
            types.FunctionDeclaration(
                name=definition["name"],
                description=definition["description"],
                parameters=definition.get("parameters"),
            )
            for definition in TOOL_DEFINITIONS
        ]
        tools = [types.Tool(function_declarations=declarations)]
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=tools,
            temperature=0.25,
            max_output_tokens=1200,
        )
        http_options = types.HttpOptions(
            timeout=max(settings.CHATBOT_TIMEOUT_SECONDS, 1) * 1000
        )

        # The SDK's async context manager closes its HTTP connection pool even
        # when a request or one of the local data tools raises an exception.
        async with genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=http_options,
        ).aio as client:
            for round_index in range(max(settings.CHATBOT_MAX_TOOL_ROUNDS, 0) + 1):
                response = await client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=contents,
                    config=config,
                )
                candidate = response.candidates[0] if response.candidates else None
                candidate_content = candidate.content if candidate else None
                parts = candidate_content.parts if candidate_content else None
                function_calls = [
                    part.function_call
                    for part in (parts or [])
                    if getattr(part, "function_call", None)
                ]

                if not function_calls:
                    text = response.text
                    if not text and parts:
                        text = "\n".join(
                            part.text for part in parts if getattr(part, "text", None)
                        )
                    if text:
                        return text.strip()
                    break

                # Stop runaway tool loops while still giving Gemini one final
                # turn to write an answer after the last permitted tool round.
                if round_index >= max(settings.CHATBOT_MAX_TOOL_ROUNDS, 0):
                    break

                if candidate_content is not None:
                    contents.append(candidate_content)

                function_response_parts: list[types.Part] = []
                for function_call in function_calls:
                    function_name = function_call.name
                    if not function_name:
                        continue

                    args = dict(function_call.args or {})
                    result = await execute_tool(
                        function_name,
                        args,
                        self.services_map,
                    )
                    if function_name not in tools_called:
                        tools_called.append(function_name)
                    self._add_source(sources, function_name)

                    self.db.add(
                        ChatMessage(
                            user_id=user_id,
                            conversation_id=conversation_id,
                            role="tool",
                            content=json.dumps(result, default=str),
                            tool_name=function_name,
                            tool_result=result,
                        )
                    )

                    response_args: dict[str, Any] = {
                        "name": function_name,
                        "response": {"result": result},
                    }
                    if function_call.id:
                        response_args["id"] = function_call.id
                    function_response_parts.append(
                        types.Part.from_function_response(**response_args)
                    )

                if not function_response_parts:
                    break

                contents.append(
                    types.Content(role="user", parts=function_response_parts)
                )

        return "I couldn't produce a complete answer from the available data. Please try asking in a different way."

    async def process_message(
        self,
        user_id: uuid.UUID,
        message: str,
        conversation_id: str | None = None,
    ) -> ChatMessageResponse:
        message = message.strip()
        if not message:
            # The request schema rejects this too; retain the guard for direct
            # service callers so whitespace can never become an empty DB turn.
            raise ValueError("Message cannot be empty.")

        if conversation_id:
            conversation_exists = await self.db.scalar(
                select(ChatMessage.id)
                .where(
                    ChatMessage.user_id == user_id,
                    ChatMessage.conversation_id == conversation_id,
                )
                .limit(1)
            )
            if conversation_exists is None:
                raise NotFoundError("Conversation not found.")
        else:
            conversation_id = str(uuid.uuid4())

        # Fetch history before inserting the current turn (otherwise the new
        # user prompt was accidentally sent to Gemini twice).
        history = await self._get_history(user_id, conversation_id)
        self.db.add(
            ChatMessage(
                user_id=user_id,
                conversation_id=conversation_id,
                role="user",
                content=message,
            )
        )
        await self.db.flush()

        sources: list[ChatSource] = []
        tools_called: list[str] = []
        assistant_mode: Literal["gemini", "fallback"] = "fallback"
        configured = settings.CHATBOT_ENABLED and bool(settings.GEMINI_API_KEY.strip())

        if configured:
            try:
                answer = await self._generate_gemini_answer(
                    history,
                    message,
                    user_id,
                    conversation_id,
                    sources,
                    tools_called,
                )
                assistant_mode = "gemini"
            except Exception:
                # Do not return vendor errors, stack traces, or key-bearing
                # request URLs to end users. Keep the app useful in data-only
                # mode and log the diagnostic on the server instead.
                logger.exception("Gemini chatbot request failed")
                answer, tools_called = await self._fallback_responder(message)
                for tool_name in tools_called:
                    self._add_source(sources, tool_name)
                answer = (
                    "Gemini is temporarily unavailable, so I switched to a "
                    "live data-only answer.\n\n"
                    + answer
                )
        else:
            answer, tools_called = await self._fallback_responder(message)
            for tool_name in tools_called:
                self._add_source(sources, tool_name)
            answer = (
                "Gemini is disabled or not configured, so I'm answering from live "
                "application data only. Configure GEMINI_API_KEY and set "
                "CHATBOT_ENABLED=true on the backend to enable the full assistant.\n\n"
                + answer
            )

        assistant_message = ChatMessage(
            user_id=user_id,
            conversation_id=conversation_id,
            role="assistant",
            content=answer,
        )
        self.db.add(assistant_message)
        await self.db.commit()

        suggested: list[str] = []
        self._generate_suggested(suggested, tools_called)

        return ChatMessageResponse(
            conversation_id=conversation_id,
            message_id=str(assistant_message.id),
            answer=answer,
            sources=sources,
            suggested_followups=suggested,
            tool_calls_made=tools_called,
            assistant_mode=assistant_mode,
        )

    @staticmethod
    def _add_source(sources: list[ChatSource], tool_name: str) -> None:
        source: ChatSource | None = None
        if "inventory" in tool_name:
            source = ChatSource(type="inventory", label="Inventory data", route="/inventory")
        elif "supplier" in tool_name:
            source = ChatSource(type="supplier", label="Supplier data", route="/suppliers")
        elif "warehouse" in tool_name:
            source = ChatSource(type="warehouse", label="Warehouse data", route="/warehouses")
        elif "dashboard" in tool_name:
            source = ChatSource(type="dashboard", label="Dashboard KPIs", route="/dashboard")
        elif "alert" in tool_name:
            source = ChatSource(type="alert", label="Alert system", route="/alerts")
        elif "recommendation" in tool_name:
            source = ChatSource(type="recommendation", label="AI recommendations", route="/recommendations")
        elif "simulation" in tool_name:
            source = ChatSource(type="simulation", label="Simulation history", route="/simulation")
        elif "forecast" in tool_name:
            source = ChatSource(type="forecast", label="Forecast models", route="/forecast")

        if source and all(existing.type != source.type for existing in sources):
            sources.append(source)

    @staticmethod
    def _generate_suggested(suggested: list[str], tools: list[str]) -> None:
        if "get_inventory_status" in tools:
            suggested.extend(
                ["Which products need reordering?", "Run a demand forecast"]
            )
        if "get_supplier_info" in tools:
            suggested.extend(
                ["Show the latest supply chain alerts", "Compare supplier risk"]
            )
        if "get_dashboard_summary" in tools:
            suggested.extend(
                ["Check current inventory levels", "What are the top recommendations?"]
            )
        if "get_simulation_history" in tools:
            suggested.append("What actions could improve resilience?")
        if not suggested:
            suggested.extend(
                ["How is our supply chain performing?", "Show the latest alerts"]
            )

    async def _fallback_responder(self, message: str) -> tuple[str, list[str]]:
        """Answer common supply-chain questions with live data when Gemini is off."""
        lowered = message.lower()
        if any(word in lowered for word in ("inventory", "stock", "reorder")):
            tool_name, label = "get_inventory_status", "Inventory summary"
        elif "supplier" in lowered:
            tool_name, label = "get_supplier_info", "Supplier results"
        elif "warehouse" in lowered:
            tool_name, label = "get_warehouse_status", "Warehouse status"
        elif "alert" in lowered or "risk" in lowered:
            tool_name, label = "get_recent_alerts", "Recent alerts"
        elif "forecast" in lowered or "demand" in lowered:
            tool_name, label = "run_quick_forecast", "Demand forecast"
        elif "recommendation" in lowered or "recommend" in lowered:
            tool_name, label = "get_recommendations", "Recommendations"
        elif "simulation" in lowered or "disruption" in lowered:
            tool_name, label = "get_simulation_history", "Recent simulations"
        else:
            tool_name, label = "get_dashboard_summary", "Supply chain overview"

        result = await execute_tool(tool_name, {}, self.services_map)
        if result.get("error"):
            answer = (
                f"I couldn't load {label.lower()} right now. Please try again in a moment."
            )
        else:
            answer = (
                f"**{label}**\n\n```json\n"
                f"{json.dumps(result, indent=2, default=str)}\n```"
            )
        return answer, [tool_name]

    async def list_conversations(
        self, user_id: uuid.UUID
    ) -> list[ConversationListItem]:
        """Return the user's latest conversations, with a first-prompt title."""
        stats_stmt = (
            select(
                ChatMessage.conversation_id,
                func.count(ChatMessage.id).label("message_count"),
                func.max(ChatMessage.created_at).label("last_message_at"),
            )
            .where(
                ChatMessage.user_id == user_id,
                ChatMessage.role.in_(("user", "assistant")),
            )
            .group_by(ChatMessage.conversation_id)
            .order_by(func.max(ChatMessage.created_at).desc())
            .limit(50)
        )
        stats_result = await self.db.execute(stats_stmt)
        stats = stats_result.all()
        if not stats:
            return []

        conversation_ids = [row.conversation_id for row in stats]
        titles_stmt = (
            select(ChatMessage.conversation_id, ChatMessage.content)
            .where(
                ChatMessage.user_id == user_id,
                ChatMessage.role == "user",
                ChatMessage.conversation_id.in_(conversation_ids),
            )
            .order_by(ChatMessage.created_at.asc())
        )
        titles_result = await self.db.execute(titles_stmt)
        titles: dict[str, str] = {}
        for row in titles_result.all():
            titles.setdefault(row.conversation_id, row.content)

        conversations: list[ConversationListItem] = []
        for row in stats:
            title = titles.get(row.conversation_id) or "New conversation"
            if len(title) > 48:
                title = f"{title[:45].rstrip()}..."
            conversations.append(
                ConversationListItem(
                    conversation_id=row.conversation_id,
                    title=title,
                    message_count=row.message_count,
                    last_message_at=row.last_message_at,
                )
            )
        return conversations

    async def get_conversation(
        self, user_id: uuid.UUID, conversation_id: str
    ) -> list[ConversationMessage]:
        """Load user/assistant turns only when the conversation belongs to user."""
        stmt = (
            select(ChatMessage)
            .where(
                ChatMessage.user_id == user_id,
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.role.in_(("user", "assistant")),
            )
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.db.execute(stmt)
        rows = result.scalars().all()
        if not rows:
            raise NotFoundError("Conversation not found.")
        return [
            ConversationMessage(
                message_id=str(row.id),
                role=row.role,
                content=row.content,
                created_at=row.created_at,
            )
            for row in rows
        ]

    async def delete_conversation(
        self, user_id: uuid.UUID, conversation_id: str
    ) -> None:
        exists = await self.db.scalar(
            select(ChatMessage.id)
            .where(
                ChatMessage.user_id == user_id,
                ChatMessage.conversation_id == conversation_id,
            )
            .limit(1)
        )
        if exists is None:
            raise NotFoundError("Conversation not found.")

        await self.db.execute(
            delete(ChatMessage).where(
                ChatMessage.user_id == user_id,
                ChatMessage.conversation_id == conversation_id,
            )
        )
        await self.db.commit()
