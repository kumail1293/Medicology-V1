import React from "react";
import { clsx } from "clsx";

/* Deterministic colour from a name so the same user always gets the same
 * avatar background, even before they upload a picture. */
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
];

function initialsOf(name: string): string {
  const clean = (name || "?").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function colorFor(name: string): string {
  const code = (name || "?").charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function UserAvatar({
  name,
  src,
  size = 40,
  className,
  ring,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s avatar` : "Avatar"}
        style={style}
        className={clsx(
          "rounded-full object-cover shrink-0 select-none",
          ring && "ring-2 ring-primary/30",
          className,
        )}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }

  return (
    <div
      style={style}
      className={clsx(
        "rounded-full flex items-center justify-center font-bold shrink-0 select-none",
        colorFor(name ?? ""),
        ring && "ring-2 ring-primary/30",
        className,
      )}
    >
      {initialsOf(name ?? "")}
    </div>
  );
}
