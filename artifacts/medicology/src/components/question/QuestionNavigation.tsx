import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface QuestionNavigationProps {
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export function QuestionNavigation({
  hasNext,
  hasPrev,
  onNext,
  onPrev,
}: QuestionNavigationProps) {
  return (
    <div className="flex gap-3 justify-between">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={!hasPrev}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <Button
        onClick={onNext}
        disabled={!hasNext}
        className="flex items-center gap-2"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
