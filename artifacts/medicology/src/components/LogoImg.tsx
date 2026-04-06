import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { Building2 } from "lucide-react";

interface LogoImgProps {
  src?: string;
  fallback?: ReactNode;
  size?: number;
  className?: string;
}

export function LogoImg({ src, fallback, size = 40, className = "" }: LogoImgProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={className}>{fallback ?? <Building2 size={size * 0.7} className="text-muted-foreground/40" />}</span>;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={clsx("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
