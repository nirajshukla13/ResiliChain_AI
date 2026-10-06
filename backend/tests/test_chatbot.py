"""AI assistant provider, conversation, and data-isolation tests."""

from app.core.config import settings
from app.services.chatbot_service import ChatbotService


async def test_chatbot_status_and_suggestions(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")

    status = await client.get("/api/v1/chatbot/status", headers=auth_headers)
    assert status.status_code == 200
    assert status.json() == {
        "configured": False,
        "provider": "Live data mode",
        "model": None,
    }

    suggestions = await client.get(
        "/api/v1/chatbot/suggestions", headers=auth_headers
    )
    assert suggestions.status_code == 200
    assert len(suggestions.json()["suggestions"]) >= 4


async def test_gemini_history_excludes_current_prompt(
    client, auth_headers, monkeypatch
):
    """The current user prompt should be included exactly once per model call."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-key")
    monkeypatch.setattr(settings, "CHATBOT_ENABLED", True)
    calls = []

    async def fake_generate(
        self,
        history,
        message,
        user_id,
        conversation_id,
        sources,
        tools_called,
    ):
        calls.append(
            (
                [part.text for turn in history for part in (turn.parts or [])],
                message,
            )
        )
        return f"Assistant response to: {message}"

    monkeypatch.setattr(ChatbotService, "_generate_gemini_answer", fake_generate)

    first = await client.post(
        "/api/v1/chatbot/message",
        json={"message": "How is inventory looking?"},
        headers=auth_headers,
    )
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body["assistant_mode"] == "gemini"
    assert calls[0] == ([], "How is inventory looking?")

    second = await client.post(
        "/api/v1/chatbot/message",
        json={
            "message": "What should I do next?",
            "conversation_id": first_body["conversation_id"],
        },
        headers=auth_headers,
    )
    assert second.status_code == 200, second.text
    assert calls[1] == (
        ["How is inventory looking?", "Assistant response to: How is inventory looking?"],
        "What should I do next?",
    )

    history = await client.get(
        f"/api/v1/chatbot/conversations/{first_body['conversation_id']}",
        headers=auth_headers,
    )
    assert history.status_code == 200
    assert [turn["role"] for turn in history.json()] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]

    listed = await client.get("/api/v1/chatbot/conversations", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["title"] == "How is inventory looking?"
    assert listed.json()[0]["message_count"] == 4


async def test_gemini_failure_uses_safe_live_data_fallback(
    client, auth_headers, monkeypatch
):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-key")
    monkeypatch.setattr(settings, "CHATBOT_ENABLED", True)

    async def failing_generate(*args, **kwargs):
        raise RuntimeError("simulated provider failure with sensitive details")

    monkeypatch.setattr(ChatbotService, "_generate_gemini_answer", failing_generate)

    response = await client.post(
        "/api/v1/chatbot/message",
        json={"message": "Check the current inventory."},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["assistant_mode"] == "fallback"
    assert "temporarily unavailable" in body["answer"]
    assert "sensitive details" not in body["answer"]
    assert body["tool_calls_made"] == ["get_inventory_status"]


async def test_chatbot_conversation_is_private_and_deletable(
    client, auth_headers, monkeypatch
):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-key")
    monkeypatch.setattr(settings, "CHATBOT_ENABLED", True)

    async def fake_generate(
        self,
        history,
        message,
        user_id,
        conversation_id,
        sources,
        tools_called,
    ):
        return "A private answer."

    monkeypatch.setattr(ChatbotService, "_generate_gemini_answer", fake_generate)

    response = await client.post(
        "/api/v1/chatbot/message",
        json={"message": "Summarize my dashboard."},
        headers=auth_headers,
    )
    assert response.status_code == 200
    conversation_id = response.json()["conversation_id"]

    second_user = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "chatbot-other-user@test.com",
            "password": "Password123!",
            "full_name": "Another User",
        },
    )
    assert second_user.status_code == 201
    other_headers = {
        "Authorization": f"Bearer {second_user.json()['tokens']['access_token']}"
    }

    private_history = await client.get(
        f"/api/v1/chatbot/conversations/{conversation_id}",
        headers=other_headers,
    )
    assert private_history.status_code == 404

    deleted = await client.delete(
        f"/api/v1/chatbot/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 200

    missing = await client.get(
        f"/api/v1/chatbot/conversations/{conversation_id}",
        headers=auth_headers,
    )
    assert missing.status_code == 404
