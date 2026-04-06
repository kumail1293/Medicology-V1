import { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "light" | "dark" | "easy" | "usmle" | "oled";
export type FontFamily = "sans" | "serif" | "mono";
export type FontSize = "sm" | "md" | "lg" | "xl";

export interface AppSettings {
  theme: AppTheme;
  fontFamily: FontFamily;
  fontSize: FontSize;
  accentColor: string;
}

const DEFAULTS: AppSettings = {
  theme: "light",
  fontFamily: "sans",
  fontSize: "md",
  accentColor: "teal",
};

const STORAGE_KEY = "medicology_settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function applySettings(s: AppSettings) {
  const root = document.documentElement;

  root.classList.remove("dark", "easy", "usmle", "oled");
  if (s.theme === "dark") root.classList.add("dark");
  else if (s.theme === "easy") root.classList.add("easy");
  else if (s.theme === "usmle") root.classList.add("usmle");
  else if (s.theme === "oled") root.classList.add("oled");

  root.classList.remove("text-size-sm", "text-size-md", "text-size-lg", "text-size-xl");
  root.classList.add(`text-size-${s.fontSize}`);

  root.classList.remove("font-sans-override", "font-serif-override", "font-mono-override");
  root.classList.add(`font-${s.fontFamily}-override`);
}

interface SettingsContextType {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULTS,
  update: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  const update = (partial: Partial<AppSettings>) =>
    setSettings((prev) => ({ ...prev, ...partial }));

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
