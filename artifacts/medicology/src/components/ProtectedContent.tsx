import { useRef } from "react";
import { createWatermarkCanvas } from "@/lib/contentProtection";

interface Props {
  children: React.ReactNode;
  className?: string;
  watermarkText?: string;
  enableBlur?: boolean;
}

export function ProtectedContent({
  children, className, watermarkText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasUrl = watermarkText ? createWatermarkCanvas(watermarkText) : null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", userSelect: "none", WebkitUserSelect: "none" }}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {canvasUrl && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${canvasUrl})`,
            backgroundRepeat: "repeat",
            pointerEvents: "none",
            zIndex: 9,
            mixBlendMode: "multiply",
          }}
        />
      )}
      {children}
    </div>
  );
}
