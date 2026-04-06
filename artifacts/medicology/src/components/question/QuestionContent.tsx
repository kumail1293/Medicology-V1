import { Card, CardContent } from "@/components/ui/card";

interface QuestionContentProps {
  text: string;
  imageUrl?: string;
  onImageClick?: (url: string) => void;
}

export function QuestionContent({
  text,
  imageUrl,
  onImageClick,
}: QuestionContentProps) {
  return (
    <Card>
      <CardContent className="p-5">
        {imageUrl && (
          <button
            onClick={() => onImageClick?.(imageUrl)}
            className="mb-3 rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-pointer block w-full"
          >
            <img src={imageUrl} alt="Question" className="max-h-64 w-full object-contain" />
          </button>
        )}
        <p className="text-base leading-relaxed font-medium">{text}</p>
      </CardContent>
    </Card>
  );
}
