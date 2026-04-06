import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

interface QuestionExplanationProps {
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
  explanationImageUrl?: string;
  onImageClick?: (url: string) => void;
}

export function QuestionExplanation({
  correctAnswer,
  explanation,
  isCorrect,
  explanationImageUrl,
  onImageClick,
}: QuestionExplanationProps) {
  return (
    <Card className="animate-in fade-in border-primary/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <span className="font-semibold text-sm">Explanation</span>
          {isCorrect
            ? <Badge className="bg-green-500 text-white text-xs">Correct!</Badge>
            : <Badge variant="destructive" className="text-xs">Incorrect</Badge>
          }
        </div>
        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <p className="font-medium text-green-600 dark:text-green-400 mb-1">
              ✓ Why {correctAnswer} is correct:
            </p>
            <p className="text-muted-foreground">{explanation}</p>
            {explanationImageUrl && (
              <button
                onClick={() => onImageClick?.(explanationImageUrl)}
                className="mt-2 rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-pointer block max-w-full"
              >
                <img src={explanationImageUrl} alt="Explanation" className="max-h-48 w-full object-contain" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
