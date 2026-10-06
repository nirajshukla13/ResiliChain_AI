import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Check,
  Clock3,
  GripVertical,
  History,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
  X,
  ArrowUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api";
import { ChatbotApi } from "@/services/endpoints";
import type {
  ChatMessage as ChatMessageType,
  ConversationListItem,
} from "@/types";
import { ChatMessage } from "./ChatMessage";
import { SuggestedQueries } from "./SuggestedQueries";
import { TypingIndicator } from "./TypingIndicator";
import { toast } from "sonner";

const POSITION_STORAGE_KEY = "rc_chat_widget_position";
const CONVERSATION_STORAGE_KEY = "rc_chat_conversation_id";
const VOICE_STORAGE_KEY = "rc_chat_voice_mode";
const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 550;
const EDGE_GAP = 12;
const DEFAULT_SUGGESTIONS = [
  "How is our supply chain performing today?",
  "Which products are running low on stock?",
  "What are the current critical alerts?",
  "Show me supplier reliability rankings",
];

type AssistantState = "idle" | "listening" | "processing" | "speaking" | "error";
type WidgetPosition = { x: number; y: number };
type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

function getDefaultPosition(): WidgetPosition {
  if (typeof window === "undefined") return { x: EDGE_GAP, y: EDGE_GAP };
  // The launcher starts at the familiar bottom-right corner; the open panel
  // is clamped into view when it expands.
  return {
    x: Math.max(EDGE_GAP, window.innerWidth - 56 - 24),
    y: Math.max(EDGE_GAP, window.innerHeight - 56 - 24),
  };
}

function getSavedPosition(): WidgetPosition {
  const fallback = getDefaultPosition();
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<WidgetPosition>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Ignore stale or blocked local storage and use the default location.
  }
  return fallback;
}

function savePosition(position: WidgetPosition) {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // The widget still works for this session when storage is unavailable.
  }
}

function getOpenPosition(anchor: WidgetPosition): WidgetPosition {
  if (typeof window === "undefined") return anchor;
  const width = Math.min(PANEL_WIDTH, Math.max(56, window.innerWidth - EDGE_GAP * 2));
  const height = Math.min(PANEL_HEIGHT, Math.max(56, window.innerHeight - EDGE_GAP * 2));
  const maxX = Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP);
  return {
    x: Math.round(Math.min(maxX, Math.max(EDGE_GAP, anchor.x - (width - 56)))),
    y: Math.round(Math.min(maxY, Math.max(EDGE_GAP, anchor.y - (height - 56)))),
  };
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`#]/g, "")
    .replace(/<[^>]*>?/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [isVoiceMode, setIsVoiceMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(VOICE_STORAGE_KEY) === "1";
  });
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CONVERSATION_STORAGE_KEY);
  });
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [chatbotConfigured, setChatbotConfigured] = useState<boolean | null>(null);
  const [position, setPosition] = useState(getSavedPosition);

  const dragRef = useRef<DragState | null>(null);
  const didDragRef = useRef(false);
  const positionRef = useRef(position);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const finalTranscriptRef = useRef("");
  const isSendingRef = useRef(false);

  const clampPosition = useCallback((x: number, y: number): WidgetPosition => {
    if (typeof window === "undefined") return { x, y };
    // The saved point is the launcher position; the open panel is placed above
    // and to the left of it, so both states share one stable drag anchor.
    const maxX = Math.max(EDGE_GAP, window.innerWidth - 56 - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, window.innerHeight - 56 - EDGE_GAP);
    return {
      x: Math.round(Math.min(maxX, Math.max(EDGE_GAP, x))),
      y: Math.round(Math.min(maxY, Math.max(EDGE_GAP, y))),
    };
  }, []);

  const updatePosition = useCallback(
    (next: WidgetPosition, persist = false) => {
      const bounded = clampPosition(next.x, next.y);
      positionRef.current = bounded;
      setPosition(bounded);
      if (persist) savePosition(bounded);
      return bounded;
    },
    [clampPosition],
  );

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    setAssistantState((current) => (current === "speaking" ? "idle" : current));
  }, []);

  const speakResponse = useCallback(
    (text: string) => {
      if (!isVoiceMode || !synthRef.current) return;
      stopSpeaking();
      const cleanText = cleanForSpeech(text);
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const naturalVoice = synthRef.current
        .getVoices()
        .find(
          (voice) =>
            voice.lang.startsWith("en") &&
            /google|natural|online/i.test(voice.name),
        );
      if (naturalVoice) utterance.voice = naturalVoice;

      utterance.onstart = () => setAssistantState("speaking");
      utterance.onend = () => setAssistantState("idle");
      utterance.onerror = () => setAssistantState("idle");
      synthRef.current.speak(utterance);
    },
    [isVoiceMode, stopSpeaking],
  );

  const refreshConversations = async () => {
    try {
      setConversations(await ChatbotApi.conversations());
    } catch {
      // Conversation refresh is secondary to the message response.
    }
  };

  const loadConversation = async (id: string, quiet = false) => {
    if (assistantState === "processing" || loadingConversationId) return;
    setLoadingConversationId(id);
    setIsHistoryOpen(false);
    stopSpeaking();
    try {
      const history = await ChatbotApi.getConversation(id);
      const restored: ChatMessageType[] = history.map((item) => ({
        id: item.message_id,
        role: item.role,
        content: item.content,
        timestamp: new Date(item.created_at),
      }));
      setMessages(restored);
      setConversationId(id);
      localStorage.setItem(CONVERSATION_STORAGE_KEY, id);
      setAssistantState("idle");
    } catch (error) {
      if (!quiet) {
        toast.error("Couldn't open conversation", {
          description:
            error instanceof ApiError ? error.message : "Please try again.",
        });
      }
      if (localStorage.getItem(CONVERSATION_STORAGE_KEY) === id) {
        localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      }
      setConversationId(null);
    } finally {
      setLoadingConversationId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const [statusResult, suggestionsResult, conversationsResult] =
        await Promise.allSettled([
          ChatbotApi.status(),
          ChatbotApi.suggestions(),
          ChatbotApi.conversations(),
        ]);
      if (cancelled) return;

      if (statusResult.status === "fulfilled") {
        setChatbotConfigured(statusResult.value.configured);
      }
      if (suggestionsResult.status === "fulfilled") {
        setSuggestions(suggestionsResult.value.suggestions);
      }
      if (conversationsResult.status === "fulfilled") {
        const items = conversationsResult.value;
        setConversations(items);
        const savedId = localStorage.getItem(CONVERSATION_STORAGE_KEY);
        const selected = items.find((item) => item.conversation_id === savedId) ?? items[0];
        if (selected) {
          await loadConversation(selected.conversation_id, true);
        } else {
          localStorage.removeItem(CONVERSATION_STORAGE_KEY);
          setConversationId(null);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
    // The initial history restoration intentionally runs once per widget mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => {
      updatePosition(positionRef.current, true);
    });
    const onResize = () => updatePosition(positionRef.current, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      synthRef.current?.cancel();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Recognition can already be stopped during unmount.
        }
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantState, isOpen]);

  const handleSend = async (text: string, fromVoice = false) => {
    const trimmed = text.trim();
    if (!trimmed || isSendingRef.current || loadingConversationId !== null) return;
    isSendingRef.current = true;

    // A typed send should stop listening without letting the recognizer send a
    // second copy of the same transcript when its onend event fires.
    if (!fromVoice && recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      finalTranscriptRef.current = "";
      try {
        recognition.stop();
      } catch {
        // The recognizer may already have ended.
      }
    }
    stopSpeaking();

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setAssistantState("processing");

    try {
      const response = await ChatbotApi.sendMessage(
        trimmed,
        conversationId ?? undefined,
      );
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
        localStorage.setItem(CONVERSATION_STORAGE_KEY, response.conversation_id);
      }

      const assistantMessage: ChatMessageType = {
        id: response.message_id || crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        suggested_followups: response.suggested_followups,
        tool_calls_made: response.tool_calls_made,
        assistant_mode: response.assistant_mode,
        timestamp: new Date(),
      };
      setMessages((current) => [...current, assistantMessage]);
      setAssistantState("idle");
      if (isVoiceMode) speakResponse(response.answer);
      void refreshConversations();
    } catch (error) {
      console.error("Failed to send chatbot message:", error);
      setAssistantState("error");
      toast.error("Message failed", {
        description:
          error instanceof ApiError
            ? error.message
            : "Couldn't reach the assistant. Check your connection and try again.",
      });
      window.setTimeout(() => {
        setAssistantState((current) => (current === "error" ? "idle" : current));
      }, 3000);
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleNewConversation = () => {
    if (assistantState === "processing") return;
    stopSpeaking();
    setMessages([]);
    setInput("");
    setConversationId(null);
    setIsHistoryOpen(false);
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    setAssistantState("idle");
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await ChatbotApi.deleteConversation(id);
      setConversations((current) =>
        current.filter((item) => item.conversation_id !== id),
      );
      if (conversationId === id) handleNewConversation();
      toast.success("Conversation deleted");
    } catch (error) {
      toast.error("Couldn't delete conversation", {
        description:
          error instanceof ApiError ? error.message : "Please try again.",
      });
    }
  };

  const handleDragStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const dragSurface = isOpen
      ? document.getElementById("resilichain-chat-panel")
      : event.currentTarget;
    const rect = dragSurface?.getBoundingClientRect();
    if (!rect) return;
    didDragRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is not required on older browsers.
    }
  };

  const handleDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) {
      return;
    }
    drag.moved = true;
    event.preventDefault();
    const next = {
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    };
    if (isOpen && typeof window !== "undefined") {
      const panelWidth = Math.min(
        PANEL_WIDTH,
        Math.max(56, window.innerWidth - EDGE_GAP * 2),
      );
      const panelHeight = Math.min(
        PANEL_HEIGHT,
        Math.max(56, window.innerHeight - EDGE_GAP * 2),
      );
      next.x += panelWidth - 56;
      next.y += panelHeight - 56;
    }
    updatePosition(next, false);
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    didDragRef.current = drag.moved;
    if (drag.moved) {
      savePosition(positionRef.current);
      // The click event follows pointerup in the same task. Clear the flag
      // afterwards for browsers that suppress click after a drag.
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 0);
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
  };

  const handleLauncherClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setIsOpen(true);
  };

  const handleDragKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const directions: Record<string, WidgetPosition> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 48 : 16;
    updatePosition(
      {
        x: positionRef.current.x + direction.x * step,
        y: positionRef.current.y + direction.y * step,
      },
      true,
    );
  };

  const handleVoiceInput = () => {
    if (assistantState === "speaking") stopSpeaking();
    if (assistantState === "listening") {
      try {
        recognitionRef.current?.stop();
      } catch {
        setAssistantState("idle");
      }
      return;
    }
    if (assistantState === "processing") return;

    const speechWindow = window as Window & {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const SpeechRecognitionConstructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      toast.error("Voice input isn't supported", {
        description: "Try a browser with speech recognition support, or type your message.",
      });
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    finalTranscriptRef.current = "";

    recognition.onstart = () => {
      setAssistantState("listening");
      setInput("");
    };
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) finalTranscriptRef.current += final;
      setInput(`${finalTranscriptRef.current}${interim}`);
    };
    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setAssistantState("error");
      if (event.error === "no-speech") {
        toast.error("No speech detected", {
          description: "I didn't hear anything. Please try again.",
        });
      } else if (event.error === "not-allowed") {
        toast.error("Microphone blocked", {
          description: "Allow microphone access in your browser to use voice input.",
        });
      } else {
        toast.error("Microphone error", { description: event.error });
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      const transcript = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";
      if (transcript) {
        void handleSend(transcript, true);
      } else {
        setAssistantState((current) =>
          current === "listening" || current === "error" ? "idle" : current,
        );
      }
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setAssistantState("idle");
      toast.error("Microphone error", {
        description: "Couldn't start voice input. Check microphone permissions.",
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend(input);
    }
  };

  const toggleVoiceMode = () => {
    setIsVoiceMode((current) => {
      const next = !current;
      localStorage.setItem(VOICE_STORAGE_KEY, next ? "1" : "0");
      if (!next) stopSpeaking();
      return next;
    });
  };

  const placeholder = {
    listening: "Listening... please speak",
    processing: "Thinking...",
    speaking: "Assistant is speaking...",
    error: "Something went wrong",
    idle: "Type or speak a message...",
  }[assistantState];

  const suggestedFollowups =
    messages.at(-1)?.role === "assistant"
      ? messages.at(-1)?.suggested_followups ?? []
      : [];
  const widgetPosition = isOpen ? getOpenPosition(position) : position;

  return (
    <>
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.button
            key="chat-launcher"
            type="button"
            style={{ left: position.x, top: position.y }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLauncherClick}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            aria-label="Open assistant or drag it to move"
            title="Click to open · drag to move"
            className="fixed z-50 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-400" />
          </motion.button>
        )}

        {isOpen && (
          <motion.section
            key="chat-panel"
            id="resilichain-chat-panel"
            style={{
              left: widgetPosition.x,
              top: widgetPosition.y,
              width: "min(400px, calc(100vw - 24px))",
              height: "min(550px, calc(100dvh - 24px))",
            }}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18 }}
            aria-label="ResiliChain AI chat"
            className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            <header className="relative z-10 flex shrink-0 items-center gap-2 bg-gradient-to-r from-primary to-primary/90 px-3 py-3 text-primary-foreground">
              <button
                type="button"
                aria-label="Move chatbot. Use arrow keys to move it by 16 pixels. Hold Shift for larger steps."
                title="Drag to move · Arrow keys also work"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
                onKeyDown={handleDragKeyDown}
                className="touch-none cursor-grab rounded-md p-1 text-primary-foreground/80 hover:bg-primary-foreground/15 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-4 w-4 shrink-0" />
                  <span className="truncate">ResiliChain Assistant</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-primary-foreground/80">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      chatbotConfigured === false
                        ? "bg-amber-300"
                        : chatbotConfigured === true
                          ? "bg-emerald-300"
                          : "animate-pulse bg-primary-foreground/70"
                    }`}
                  />
                  <span>
                    {chatbotConfigured === false
                      ? "Live data mode"
                      : chatbotConfigured === true
                        ? "Gemini configured"
                        : "Connecting..."}
                  </span>
                  {conversationId && (
                    <span className="truncate text-primary-foreground/60">
                      · {conversations.find((item) => item.conversation_id === conversationId)?.title ?? "Current chat"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  onClick={handleNewConversation}
                  disabled={assistantState === "processing" || loadingConversationId !== null}
                  title="Start a new conversation"
                  aria-label="Start a new conversation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground ${isHistoryOpen ? "bg-primary-foreground/15" : ""}`}
                  onClick={() => setIsHistoryOpen((current) => !current)}
                  disabled={assistantState === "processing" || loadingConversationId !== null}
                  title="Conversation history"
                  aria-label="Conversation history"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  onClick={toggleVoiceMode}
                  title={isVoiceMode ? "Mute assistant voice" : "Enable assistant voice"}
                  aria-label={isVoiceMode ? "Mute assistant voice" : "Enable assistant voice"}
                >
                  {isVoiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-70" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground sm:inline-flex"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    setIsOpen(false);
                  }}
                  title="Minimize assistant"
                  aria-label="Minimize assistant"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground sm:hidden"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    setIsOpen(false);
                  }}
                  title="Close assistant"
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <AnimatePresence>
                {isHistoryOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    role="dialog"
                    aria-label="Conversation history"
                    className="absolute right-2 top-[calc(100%-2px)] z-30 max-h-[min(360px,60vh)] w-[min(340px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"
                  >
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                        Recent conversations
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsHistoryOpen(false)}
                        aria-label="Close conversation history"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {conversations.length === 0 ? (
                      <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                        Your conversations will appear here.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {conversations.map((conversation) => (
                          <div
                            key={conversation.conversation_id}
                            className={`group flex items-center gap-1 rounded-lg px-1 ${conversationId === conversation.conversation_id ? "bg-primary/10" : "hover:bg-muted/70"}`}
                          >
                            <button
                              type="button"
                              onClick={() => void loadConversation(conversation.conversation_id)}
                              disabled={loadingConversationId !== null || assistantState === "processing"}
                              className="min-w-0 flex-1 rounded-md px-2 py-2 text-left disabled:opacity-60"
                            >
                              <span className="block truncate text-xs font-medium">
                                {conversation.title}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                {conversation.message_count} messages · {new Date(conversation.last_message_at).toLocaleDateString()}
                              </span>
                            </button>
                            {loadingConversationId === conversation.conversation_id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <button
                                type="button"
                                aria-label={`Delete ${conversation.title}`}
                                title="Delete conversation"
                                onClick={() => void handleDeleteConversation(conversation.conversation_id)}
                                disabled={assistantState === "processing" || loadingConversationId !== null}
                                className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/10 p-4">
              {messages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-foreground">
                    What would you like to know?
                  </h3>
                  <p className="mb-4 max-w-[270px] text-xs leading-relaxed">
                    Ask about inventory, suppliers, forecasts, alerts, or the health of your supply chain.
                  </p>
                  <SuggestedQueries
                    queries={suggestions.slice(0, 4)}
                    onSelect={(query) => void handleSend(query)}
                    title="Try a question"
                  />
                </div>
              )}

              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {assistantState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex justify-start"
                >
                  <TypingIndicator />
                </motion.div>
              )}

              {assistantState !== "processing" && messages.length > 0 && suggestedFollowups.length > 0 && (
                <SuggestedQueries
                  queries={suggestedFollowups}
                  onSelect={(query) => void handleSend(query)}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-border bg-background p-3">
              <div className="relative flex items-center">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={assistantState === "processing" || loadingConversationId !== null}
                  aria-label="Chat message"
                  className={`rounded-full border-border bg-muted/50 pr-[82px] transition-all ${assistantState === "listening" ? "border-red-500/50 ring-2 ring-red-500/30" : "focus-visible:ring-primary/50"}`}
                  maxLength={2000}
                />
                <div className="absolute right-1 flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={handleVoiceInput}
                    disabled={assistantState === "processing" || loadingConversationId !== null}
                    className={`h-8 w-8 rounded-full transition-colors ${assistantState === "listening" ? "animate-pulse bg-red-500/10 text-red-500 hover:bg-red-500/20" : assistantState === "speaking" ? "animate-pulse bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" : "text-muted-foreground hover:text-foreground"}`}
                    title={assistantState === "speaking" ? "Interrupt voice playback" : assistantState === "listening" ? "Stop listening and send" : "Use voice input"}
                    aria-label={assistantState === "listening" ? "Stop listening and send" : "Use voice input"}
                  >
                    {assistantState === "speaking" ? (
                      <Volume1 className="h-4 w-4" />
                    ) : assistantState === "listening" ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => void handleSend(input)}
                    disabled={!input.trim() || assistantState === "processing" || loadingConversationId !== null}
                    className="h-8 w-8 rounded-full"
                    aria-label="Send message"
                  >
                    {assistantState === "processing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                <span>Enter to send · drag the grip to move</span>
                {assistantState === "listening" && (
                  <span className="flex items-center gap-1 text-red-500">
                    <Mic className="h-3 w-3" /> Listening
                  </span>
                )}
                {assistantState !== "listening" && isVoiceMode && (
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" /> Voice replies on
                  </span>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
