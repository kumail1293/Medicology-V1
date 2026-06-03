import { Moon, Sun } from "lucide-react";
import { useSettings } from "@/lib/settings";

export function ThemeToggle() {
  const { theme, setTheme } = useSettings();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      title="Toggle theme"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}