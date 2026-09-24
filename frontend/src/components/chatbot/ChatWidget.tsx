import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Minus, Send, ArrowUp, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatbotApi } from "@/services/endpoints";
import type { ChatMessage as ChatMessageType } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { SuggestedQueries } from "./SuggestedQueries";
import { toast } from "sonner";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = isOpen ? 0 : 0; // Or calculate based on state if needed

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

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
    } catch (error) {
      console.error("Failed to send message:", error);
      // Optional: Add error message to chat
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    // @ts-ignore - SpeechRecognition is not standard TS yet
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Not Supported", { description: "Your browser doesn't support voice input. Please try Chrome." });
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      
      setInput((prev) => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'no-speech') {
        toast.error("No speech detected", { description: "I didn't hear anything. Please try again." });
      } else if (event.error === 'not-allowed') {
        toast.error("Microphone blocked", { description: "Please allow microphone access in your browser." });
      } else {
        toast.error("Microphone error", { description: event.error });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
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
                  onClick={() => setIsOpen(false)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground rounded-full"
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
                  <p className="text-sm">Ask me about risk analysis, inventory status, or simulations.</p>
                </div>
              )}
              
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start mb-4"
                >
                  <TypingIndicator />
                </motion.div>
              )}
              
              {!isLoading && suggestedFollowups && suggestedFollowups.length > 0 && (
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
                  placeholder={isListening ? "Listening... Please speak" : "Type a message..."}
                  className="pr-[72px] rounded-full border-border bg-muted/50 focus-visible:ring-primary/50"
                  maxLength={2000}
                />
                <div className="absolute right-1 flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 rounded-full transition-colors ${
                      isListening ? "text-red-500 animate-pulse bg-red-500/10 hover:bg-red-500/20" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={handleVoiceInput}
                    title="Use voice input"
                    type="button"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isLoading}
                    type="button"
                  >
                    <ArrowUp className="h-4 w-4" />
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
