import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Minus, Send, ArrowUp, Mic, MicOff, Volume2, VolumeX, Loader2, Volume1 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatbotApi } from "@/services/endpoints";
import type { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { SuggestedQueries } from "./SuggestedQueries";
import { toast } from "sonner";

// Simple markdown stripper for TTS
const cleanForSpeech = (text: string): string => {
  if (!text) return "";
  let cleaned = text;
  // Remove markdown URLs but keep the link text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove bold/italic markers
  cleaned = cleaned.replace(/[*_~`#]/g, "");
  // Remove HTML tags if any
  cleaned = cleaned.replace(/<[^>]*>?/gm, "");
  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
};

type AssistantState = "idle" | "listening" | "processing" | "speaking" | "error";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  
  // Voice & Flow states
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // To handle the auto-send from voice, we keep a ref to the latest transcript
  const finalTranscriptRef = useRef<string>("");

  const unreadCount = isOpen ? 0 : 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, assistantState]);

  // Initialize SpeechSynthesis
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
      if (assistantState === "speaking") {
        setAssistantState("idle");
      }
    }
  }, [assistantState]);

  const speakResponse = useCallback((text: string) => {
    if (!isVoiceMode || !synthRef.current) return;
    
    stopSpeaking();
    
    const cleanText = cleanForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Optional: Select a natural English voice
    const voices = synthRef.current.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural")));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      setAssistantState("speaking");
    };

    utterance.onend = () => {
      setAssistantState("idle");
    };

    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      setAssistantState("idle");
    };

    synthRef.current.speak(utterance);
  }, [isVoiceMode, stopSpeaking]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    // Interrupt any ongoing speech
    stopSpeaking();

    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAssistantState("processing");

    try {
      const res = await ChatbotApi.sendMessage(text.trim(), conversationId || undefined);
      
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const assistantMsg: ChatMessageType = {
        id: res.message_id || crypto.randomUUID(),
        role: "assistant",
        content: res.answer,
        sources: res.sources,
        suggested_followups: res.suggested_followups,
        tool_calls_made: res.tool_calls_made,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      
      // Auto-speak response if not an error
      setAssistantState("idle");
      speakResponse(res.answer);
      
    } catch (error) {
      console.error("Failed to send message:", error);
      setAssistantState("error");
      toast.error("Message failed", { description: "Could not communicate with the assistant." });
      setTimeout(() => setAssistantState("idle"), 3000);
    }
  };

  const handleVoiceInput = () => {
    // Stop speaking if currently speaking
    if (assistantState === "speaking") {
      stopSpeaking();
    }
    
    if (assistantState === "listening") {
      // Manually stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Not Supported", { description: "Your browser doesn't support voice input. Please try Chrome." });
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = 'en-US';
    recognition.interimResults = true; // For live transcription
    recognition.continuous = false;

    finalTranscriptRef.current = "";

    recognition.onstart = () => {
      setAssistantState("listening");
      setInput("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      if (final) {
        finalTranscriptRef.current += final;
      }
      
      setInput(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: any) => {
      setAssistantState("error");
      if (event.error === 'no-speech') {
        toast.error("No speech detected", { description: "I didn't hear anything. Please try again." });
      } else if (event.error === 'not-allowed') {
        toast.error("Microphone blocked", { description: "Please allow microphone access in your browser." });
      } else if (event.error !== 'aborted') {
        toast.error("Microphone error", { description: event.error });
      }
      
      setTimeout(() => setAssistantState("idle"), 2000);
    };

    recognition.onend = () => {
      // If we finished naturally and have text, send it automatically!
      if (finalTranscriptRef.current.trim().length > 0 && assistantState === "listening") {
        handleSend(finalTranscriptRef.current);
      } else if (assistantState === "listening") {
        setAssistantState("idle");
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error(err);
      toast.error("Microphone error", { description: "Could not start microphone." });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const suggestedFollowups = messages.length > 0 && messages[messages.length - 1].role === "assistant" 
    ? messages[messages.length - 1].suggested_followups 
    : [];

  const getPlaceholderText = () => {
    switch (assistantState) {
      case "listening": return "Listening... Please speak";
      case "processing": return "Thinking...";
      case "speaking": return "Assistant is speaking...";
      case "error": return "An error occurred.";
      default: return "Type or speak a message...";
    }
  };

  return (
    <div className="fixed sm:bottom-6 sm:right-6 bottom-0 right-0 z-50">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="fab"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="absolute bottom-4 right-4 sm:bottom-0 sm:right-0 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 flex items-center justify-center text-primary-foreground focus:outline-none"
            style={{ boxShadow: "0 0 0 0 rgba(var(--primary), 0.7)" }}
          >
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-destructive border-2 border-background" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col bg-background sm:w-[400px] sm:h-[550px] w-screen h-screen sm:rounded-2xl rounded-none shadow-2xl border border-border overflow-hidden absolute bottom-0 right-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground">
              <div className="flex items-center gap-2 font-medium">
                <span className="text-xl">🤖</span> ResiliChain Assistant
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground rounded-full"
                  onClick={() => setIsVoiceMode(!isVoiceMode)}
                  title={isVoiceMode ? "Voice mode enabled. Click to mute TTS." : "Voice mode disabled. Click to enable TTS."}
                >
                  {isVoiceMode ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-50" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground rounded-full hidden sm:flex"
                  onClick={() => setIsOpen(false)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground rounded-full sm:hidden flex"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative bg-muted/10">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 text-muted-foreground">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">How can I help you?</h3>
                  <p className="text-sm">Speak or type to ask about risk analysis, inventory status, or simulations.</p>
                </div>
              )}
              
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              
              {assistantState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start mb-4"
                >
                  <TypingIndicator />
                </motion.div>
              )}
              
              {assistantState !== "processing" && suggestedFollowups && suggestedFollowups.length > 0 && (
                <SuggestedQueries queries={suggestedFollowups} onSelect={handleSend} />
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-background border-t">
              <div className="relative flex items-center">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={getPlaceholderText()}
                  disabled={assistantState === "processing"}
                  className={`pr-[80px] rounded-full border-border bg-muted/50 focus-visible:ring-primary/50 ${
                    assistantState === "listening" ? "ring-2 ring-red-500/50 border-red-500/50" : ""
                  }`}
                  maxLength={2000}
                />
                <div className="absolute right-1 flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 rounded-full transition-colors ${
                      assistantState === "listening" ? "text-red-500 animate-pulse bg-red-500/10 hover:bg-red-500/20" : 
                      assistantState === "speaking" ? "text-blue-500 animate-pulse bg-blue-500/10 hover:bg-blue-500/20" :
                      "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={handleVoiceInput}
                    title={assistantState === "speaking" ? "Interrupt assistant" : "Use voice input"}
                    type="button"
                  >
                    {assistantState === "speaking" ? <Volume1 className="h-4 w-4" /> : 
                     assistantState === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || assistantState === "processing"}
                    type="button"
                  >
                    {assistantState === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
