import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionHeaderProps {
  subject: string;
  system?: string;
  difficulty: "easy" | "medium" | "hard";
  tags?: string[];
  bookmarked: boolean;
  onBookmarkClick: () => void;
}

export function QuestionHeader({
  subject,
  system,
  difficulty,
  tags,
  bookmarked,
  onBookmarkClick,
}: QuestionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-xs">{subject}</Badge>
        {system && <Badge variant="outline" className="text-xs">{system}</Badge>}
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            difficulty === "easy" && "border-green-500/50 text-green-600",
            difficulty === "medium" && "border-yellow-500/50 text-yellow-600",
            difficulty === "hard" && "border-red-500/50 text-red-600"
          )}
        >
          {difficulty}
        </Badge>
        {tags?.includes("high_yield") && (
          <Badge className="text-xs bg-yellow-500 text-white">High Yield</Badge>
        )}
      </div>
      <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={onBookmarkClick}>
        {bookmarked
          ? <BookmarkCheck className="h-4 w-4 text-primary" />
          : <Bookmark className="h-4 w-4 text-muted-foreground" />
        }
      </Button>
    </div>
  );
}
