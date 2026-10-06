import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Search, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface ChatMessageProps {
  message: ChatMessageType;
}

function parseMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  const lines = html.split('\n');
  let inUl = false;
  let inOl = false;
  let result = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/^-\s+(.*)/)) {
      if (!inUl) {
        result += '<ul class="list-disc pl-5 my-1">\n';
        inUl = true;
      }
      result += line.replace(/^-\s+(.*)/, '<li>$1</li>\n');
      continue;
    } else if (inUl) {
      result += '</ul>\n';
      inUl = false;
    }

    if (line.match(/^\d+\.\s+(.*)/)) {
      if (!inOl) {
        result += '<ol class="list-decimal pl-5 my-1">\n';
        inOl = true;
      }
      result += line.replace(/^\d+\.\s+(.*)/, '<li>$1</li>\n');
      continue;
    } else if (inOl) {
      result += '</ol>\n';
      inOl = false;
    }

    result += line + (i < lines.length - 1 ? '<br />' : '');
  }

  if (inUl) result += '</ul>\n';
  if (inOl) result += '</ol>\n';

  return result;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex flex-col max-w-[85%] group", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative px-4 py-3 rounded-2xl text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted/50 text-foreground rounded-bl-sm pr-10" // extra padding for copy button
          )}
        >
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Copy message"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}

          {message.assistant_mode === "fallback" && (
            <Badge variant="outline" className="mb-2 text-[10px] font-normal text-amber-700 dark:text-amber-300">
              Live data mode
            </Badge>
          )}

          {message.tool_calls_made && message.tool_calls_made.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 border-b border-border/50 pb-2 text-xs text-muted-foreground">
              <Search className="h-3 w-3" />
              <span>Checked {message.tool_calls_made.join(", ")}</span>
            </div>
          )}

          <div
            className={cn("prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed", isUser ? "text-primary-foreground" : "")}
            dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
          />

          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-1.5">
              {message.sources.map((source, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className={cn(
                    "text-[10px] py-0 h-5 px-1.5 gap-1 font-normal",
                    source.route ? "cursor-pointer hover:bg-secondary/80" : "cursor-default"
                  )}
                  onClick={() => source.route && navigate(source.route)}
                >
                  {source.label}
                  {source.route && <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-50" />}
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        <span className="text-[10px] text-muted-foreground mt-1 mx-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
