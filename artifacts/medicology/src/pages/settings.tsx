import { useSettings, AppTheme, FontFamily, FontSize } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Leaf, Monitor, Type, Palette, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { settings, update } = useSettings();

  return (
    <div className="space-y-8 animate-in fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-display">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize your study environment</p>
      </div>

      {/* Theme */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Theme</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <ThemeOption
              id="light"
              current={settings.theme}
              icon={<Sun className="h-5 w-5" />}
              label="Light"
              description="Clean & bright"
              preview="bg-white border-gray-200"
              textPreview="text-gray-900"
              onClick={() => update({ theme: "light" })}
            />
            <ThemeOption
              id="dark"
              current={settings.theme}
              icon={<Moon className="h-5 w-5" />}
              label="Dark"
              description="Easy at night"
              preview="bg-slate-900 border-slate-700"
              textPreview="text-slate-100"
              onClick={() => update({ theme: "dark" })}
            />
            <ThemeOption
              id="easy"
              current={settings.theme}
              icon={<Leaf className="h-5 w-5" />}
              label="Sepia"
              description="Easy on eyes"
              preview="bg-amber-50 border-amber-200"
              textPreview="text-amber-900"
              onClick={() => update({ theme: "easy" })}
            />
            <ThemeOption
              id="usmle"
              current={settings.theme}
              icon={<Monitor className="h-5 w-5" />}
              label="USMLE"
              description="Exam interface"
              preview="bg-gray-50 border-blue-300"
              textPreview="text-blue-700"
              onClick={() => update({ theme: "usmle" })}
            />
            <ThemeOption
              id="oled"
              current={settings.theme}
              icon={<Zap className="h-5 w-5" />}
              label="OLED"
              description="True black"
              preview="bg-black border-gray-700"
              textPreview="text-white"
              onClick={() => update({ theme: "oled" })}
            />
          </div>
          {settings.theme === "usmle" && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                USMLE Exam Desk theme mimics the official NBME exam interface color scheme.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Font Family */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Font Family</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: "sans" as FontFamily, name: "DM Sans", label: "Sans-serif", desc: "Modern & readable", style: "font-sans" },
              { id: "serif" as FontFamily, name: "Merriweather", label: "Serif", desc: "Traditional academic", style: "font-serif" },
              { id: "mono" as FontFamily, name: "JetBrains", label: "Monospace", desc: "Structured & precise", style: "font-mono" },
            ]).map(({ id, name, label, desc, style }) => (
              <button
                key={id}
                onClick={() => update({ fontFamily: id })}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all",
                  settings.fontFamily === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                )}
              >
                <p className={cn("text-lg font-bold mb-1", style)} style={id === "serif" ? { fontFamily: "Merriweather, serif" } : id === "mono" ? { fontFamily: "JetBrains Mono, monospace" } : {}}>
                  Aa
                </p>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
                {settings.fontFamily === id && <Check className="h-3 w-3 text-primary mt-1" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Text Size</span>
          </div>
          <div className="flex gap-3">
            {([
              { id: "sm" as FontSize, label: "Small", size: "text-sm" },
              { id: "md" as FontSize, label: "Medium", size: "text-base" },
              { id: "lg" as FontSize, label: "Large", size: "text-lg" },
              { id: "xl" as FontSize, label: "X-Large", size: "text-xl" },
            ]).map(({ id, label, size }) => (
              <button
                key={id}
                onClick={() => update({ fontSize: id })}
                className={cn(
                  "flex-1 p-3 rounded-xl border-2 text-center transition-all",
                  settings.fontSize === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                )}
              >
                <span className={cn("font-semibold block", size)}>A</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-xl">
            <p className="text-muted-foreground" style={{ fontSize: settings.fontSize === "sm" ? 13 : settings.fontSize === "md" ? 15 : settings.fontSize === "lg" ? 17 : 19 }}>
              Sample text: The mitral valve has two leaflets and guards the left atrioventricular orifice.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Reset */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Reset to Defaults</p>
              <p className="text-sm text-muted-foreground">Restore original theme and font settings</p>
            </div>
            <Button variant="outline" onClick={() => update({ theme: "light", fontFamily: "sans", fontSize: "md", accentColor: "teal" })}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground text-center">Settings are saved automatically and persist across sessions.</div>
    </div>
  );
}

function ThemeOption({ id, current, icon, label, description, preview, textPreview, onClick }: {
  id: AppTheme;
  current: AppTheme;
  icon: React.ReactNode;
  label: string;
  description: string;
  preview: string;
  textPreview: string;
  onClick: () => void;
}) {
  const isActive = current === id;
  return (
    <button
      onClick={onClick}
      className={cn("p-3 rounded-xl border-2 text-left transition-all relative", isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}
    >
      <div className={cn("w-full h-10 rounded-lg border mb-2 flex items-center justify-center", preview)}>
        <span className={cn("text-xs font-bold", textPreview)}>Aa</span>
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {isActive && <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />}
    </button>
  );
}
