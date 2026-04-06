import { cn } from "@/lib/utils";

interface QuestionOptionProps {
  key: string;
  text: string;
  isSelected: boolean;
  isCorrect: boolean;
  answered: boolean;
  mode: "practice" | "test" | "review";
  onClick: (key: string) => void;
}

export function QuestionOption({
  key,
  text,
  isSelected,
  isCorrect,
  answered,
  mode,
  onClick,
}: QuestionOptionProps) {
  let optionStyle = "border-border hover:border-primary/50 hover:bg-accent/50";

  if (answered && mode === "practice") {
    if (isCorrect) optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/20";
    else if (isSelected && !isCorrect) optionStyle = "border-red-500 bg-red-50 dark:bg-red-900/20";
    else optionStyle = "border-border opacity-60";
  } else if (isSelected) {
    optionStyle = "border-primary bg-accent";
  }

  let badgeStyle = "bg-muted text-muted-foreground";
  if (isSelected && !answered) {
    badgeStyle = "bg-primary text-primary-foreground";
  } else if (answered && isCorrect && mode === "practice") {
    badgeStyle = "bg-green-500 text-white";
  } else if (answered && isSelected && !isCorrect && mode === "practice") {
    badgeStyle = "bg-red-500 text-white";
  }

  return (
    <button
      onClick={() => onClick(key)}
      className={cn(
        "w-full text-left p-4 rounded-lg border-2 transition-all",
        optionStyle,
        answered && mode === "practice" && "cursor-default"
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          badgeStyle
        )}>
          {key}
        </span>
        <span className="text-sm leading-relaxed pt-0.5">{text}</span>
      </div>
    </button>
  );
}
