import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestedQueriesProps {
  queries: string[];
  onSelect: (query: string) => void;
}

export function SuggestedQueries({ queries, onSelect }: SuggestedQueriesProps) {
  if (!queries || queries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 ml-1">
        <Sparkles className="h-3 w-3" /> Suggested Follow-ups
      </div>
      <div className="flex flex-wrap gap-2">
        {queries.map((query, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelect(query)}
            className="text-xs text-left h-auto py-1.5 px-3 rounded-full hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
          >
            {query}
          </Button>
        ))}
      </div>
    </div>
  );
}
