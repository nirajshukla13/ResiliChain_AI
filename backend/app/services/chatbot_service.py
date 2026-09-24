import uuid
import json
from datetime import datetime
from typing import Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from google import genai
from google.genai.types import Tool, FunctionDeclaration, Content, Part, GenerateContentConfig

from app.core.config import settings
from app.models.chat_message import ChatMessage
from app.schemas.chatbot import ChatMessageResponse, ChatSource, ConversationListItem
from app.services.dashboard_service import DashboardService
from app.services.inventory_service import InventoryService
from app.services.supplier_service import SupplierService
from app.services.warehouse_service import WarehouseService
from app.services.alert_service import AlertService
from app.services.recommendation_service import RecommendationService
from app.services.simulation_service import SimulationService
from app.services.forecast_service import ForecastService
from app.services.chatbot_tools import TOOL_DEFINITIONS, execute_tool

SYSTEM_PROMPT = """You are ResiliChain AI, an intelligent supply chain assistant.
You help managers understand their dashboard, inventory, suppliers, disruptions, and forecasts.
Be concise, analytical, and professional. Use markdown.
You have access to live tools to query the supply chain database. Use them when you need data.
Don't invent data. If a tool fails, tell the user gracefully.
Suggest actionable next steps based on the data you see.
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
        
        if settings.OPENROUTER_API_KEY and settings.CHATBOT_ENABLED:
            self._init_tools()
            
    def _init_tools(self):
        self.openrouter_tools = []
        for d in TOOL_DEFINITIONS:
            self.openrouter_tools.append({
                "type": "function",
                "function": d
            })

    async def _get_history(self, conversation_id: str) -> list[dict]:
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(settings.CHATBOT_MAX_HISTORY)
        )
        result = await self.db.execute(stmt)
        messages = result.scalars().all()
        
        contents = []
        for msg in messages:
            if msg.role == "user" and msg.content:
                contents.append({"role": "user", "content": msg.content})
            elif msg.role == "assistant" and msg.content:
                contents.append({"role": "assistant", "content": msg.content})
        return contents

    async def process_message(self, user_id: uuid.UUID, message: str, conversation_id: str | None = None) -> ChatMessageResponse:
        import httpx
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
            
        # Save user message
        user_msg = ChatMessage(
            user_id=user_id,
            conversation_id=conversation_id,
            role="user",
            content=message
        )
        self.db.add(user_msg)
        await self.db.flush()
        
        sources = []
        tools_called = []
        suggested = []
        
        if settings.OPENROUTER_API_KEY and settings.CHATBOT_ENABLED:
            history = await self._get_history(conversation_id)
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            messages.extend(history)
            messages.append({"role": "user", "content": message})
            
            headers = {
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": settings.OPENROUTER_MODEL,
                "messages": messages,
                "tools": self.openrouter_tools,
            }
            
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
                    resp.raise_for_status()
                    data = resp.json()
                    
                    response_message = data["choices"][0]["message"]
                    
                    if response_message.get("tool_calls"):
                        messages.append(response_message)
                        
                        for call in response_message["tool_calls"]:
                            call_id = call["id"]
                            fn_name = call["function"]["name"]
                            args = json.loads(call["function"]["arguments"])
                            
                            tools_called.append(fn_name)
                            self._add_source(sources, fn_name)
                            
                            result = await execute_tool(fn_name, args, self.services_map)
                            
                            # Save tool call to DB
                            tool_msg = ChatMessage(
                                user_id=user_id,
                                conversation_id=conversation_id,
                                role="tool",
                                content="",
                                tool_name=fn_name,
                                tool_result=result
                            )
                            self.db.add(tool_msg)
                            
                            messages.append({
                                "role": "tool",
                                "tool_call_id": call_id,
                                "name": fn_name,
                                "content": json.dumps(result)
                            })
                            
                        # Generate final response after tools
                        payload["messages"] = messages
                        resp2 = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
                        resp2.raise_for_status()
                        data2 = resp2.json()
                        answer = data2["choices"][0]["message"].get("content", "")
                    else:
                        answer = response_message.get("content", "")
                
                if not answer:
                    answer = "I've pulled the data. Let me know if you need any further analysis on this!"
                
            except httpx.HTTPStatusError as e:
                import traceback
                traceback.print_exc()
                try:
                    err_json = e.response.json()
                    err_msg = err_json.get("error", {}).get("message", str(e))
                except:
                    err_msg = e.response.text
                answer = f"OpenRouter Error: {err_msg}"
            except Exception as e:
                import traceback
                traceback.print_exc()
                answer = f"Sorry, I encountered an error communicating with OpenRouter: {str(e)}"
        else:
            # Fallback when API key is missing
            answer, tools_called = await self._fallback_responder(message)
            for t in tools_called:
                self._add_source(sources, t)
                
        # Save assistant message
        asst_msg = ChatMessage(
            user_id=user_id,
            conversation_id=conversation_id,
            role="assistant",
            content=answer
        )
        self.db.add(asst_msg)
        await self.db.commit()
        
        self._generate_suggested(suggested, tools_called)
        
        return ChatMessageResponse(
            conversation_id=conversation_id,
            message_id=str(asst_msg.id),
            answer=answer,
            sources=sources,
            suggested_followups=suggested,
            tool_calls_made=tools_called
        )
        
    def _add_source(self, sources: list[ChatSource], tool_name: str):
        if "inventory" in tool_name:
            sources.append(ChatSource(type="inventory", label="Inventory DB", route="/inventory"))
        elif "supplier" in tool_name:
            sources.append(ChatSource(type="supplier", label="Supplier DB", route="/suppliers"))
        elif "dashboard" in tool_name:
            sources.append(ChatSource(type="dashboard", label="Dashboard KPIs", route="/dashboard"))
        elif "alert" in tool_name:
            sources.append(ChatSource(type="alert", label="Alert System", route="/alerts"))
        elif "recommendation" in tool_name:
            sources.append(ChatSource(type="recommendation", label="AI Engine", route="/recommendations"))
        elif "simulation" in tool_name:
            sources.append(ChatSource(type="simulation", label="Monte Carlo Twin", route="/simulation"))
        elif "forecast" in tool_name:
            sources.append(ChatSource(type="forecast", label="Forecast Models", route="/forecast"))
            
    def _generate_suggested(self, suggested: list[str], tools: list[str]):
        if not tools:
            suggested.extend(["Show me the dashboard", "Check inventory levels"])
            return
            
        if "get_inventory_status" in tools:
            suggested.append("Which suppliers provide these items?")
            suggested.append("Run a forecast for this product")
        if "get_dashboard_summary" in tools:
            suggested.append("Show me the latest alerts")
            suggested.append("What are the AI recommendations?")
        if "get_simulation_history" in tools:
            suggested.append("What actions should we take based on this?")
            
    async def _fallback_responder(self, message: str) -> tuple[str, list[str]]:
        msg = message.lower()
        tools = []
        result_text = "I don't have an AI API key configured, so I'm using a simple rule-based fallback.\n\n"
        
        if "inventory" in msg or "stock" in msg:
            tools.append("get_inventory_status")
            res = await execute_tool("get_inventory_status", {}, self.services_map)
            result_text += f"**Inventory Summary:**\n```json\n{json.dumps(res.get('summary', {}), indent=2)}\n```"
        elif "supplier" in msg:
            tools.append("get_supplier_info")
            res = await execute_tool("get_supplier_info", {}, self.services_map)
            result_text += f"**Suppliers found:** {len(res.get('suppliers', []))}"
        elif "alert" in msg:
            tools.append("get_recent_alerts")
            res = await execute_tool("get_recent_alerts", {}, self.services_map)
            result_text += f"**Latest Alerts:**\n```json\n{json.dumps(res, indent=2)}\n```"
        elif "forecast" in msg:
            tools.append("run_quick_forecast")
            res = await execute_tool("run_quick_forecast", {}, self.services_map)
            result_text += f"**Forecast:**\n```json\n{json.dumps(res, indent=2)}\n```"
        elif "recommendation" in msg:
            tools.append("get_recommendations")
            res = await execute_tool("get_recommendations", {}, self.services_map)
            result_text += f"**Recommendations:**\n```json\n{json.dumps(res, indent=2)}\n```"
        elif "simulation" in msg:
            tools.append("get_simulation_history")
            res = await execute_tool("get_simulation_history", {}, self.services_map)
            result_text += f"**Simulations:**\n```json\n{json.dumps(res, indent=2)}\n```"
        else:
            tools.append("get_dashboard_summary")
            res = await execute_tool("get_dashboard_summary", {}, self.services_map)
            result_text += f"**Dashboard Overview:**\n```json\n{json.dumps(res, indent=2)}\n```"
            
        return result_text, tools

    async def list_conversations(self, user_id: uuid.UUID) -> list[ConversationListItem]:
        # We need a proper distinct query, but SQLite compatibility matters
        # Let's just fetch all and group manually for simplicity if complex grouping fails
        
        from sqlalchemy import text
        raw_stmt = text("""
            SELECT 
                conversation_id, 
                COUNT(*) as msg_count, 
                MAX(created_at) as last_msg,
                (SELECT content FROM chat_messages WHERE conversation_id = cm.conversation_id ORDER BY created_at ASC LIMIT 1) as title
            FROM chat_messages cm
            WHERE user_id = :uid
            GROUP BY conversation_id
            ORDER BY last_msg DESC
        """)
        
        result = await self.db.execute(raw_stmt, {"uid": str(user_id)})
        rows = result.fetchall()
        
        out = []
        for r in rows:
            title = r.title if r.title else "New Conversation"
            if len(title) > 30:
                title = title[:27] + "..."
            out.append(ConversationListItem(
                conversation_id=r.conversation_id,
                title=title,
                message_count=r.msg_count,
                last_message_at=r.last_msg
            ))
        return out

    async def delete_conversation(self, user_id: uuid.UUID, conversation_id: str) -> None:
        stmt = delete(ChatMessage).where(
            ChatMessage.user_id == str(user_id),
            ChatMessage.conversation_id == conversation_id
        )
        await self.db.execute(stmt)
        await self.db.commit()
