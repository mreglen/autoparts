import { useColorScheme } from "react-native";
import { useSyncExternalStore } from "react";

import { readJson, writeJson } from "../storage/kv";
import { THEME_MODE_KEY } from "../storage/keys";
import { palette } from "./tokens";

export type ThemeMode = "system" | "light" | "dark";

let themeMode: ThemeMode = "system";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setThemeMode(mode: ThemeMode): void {
  themeMode = mode;
  void writeJson(THEME_MODE_KEY, mode);
  listeners.forEach((listener) => listener());
}

/** Читается один раз при старте приложения (App.tsx). */
export async function initThemeMode(): Promise<void> {
  themeMode = await readJson<ThemeMode>(THEME_MODE_KEY, "system");
  listeners.forEach((listener) => listener());
}

export interface ThemeColors {
  brand: string;
  brandSoft: string;
  accent: string;
  surface: string;
  surfaceMuted: string;
  surfaceSubtle: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  inkFaint: string;
  line: string;
  lineStrong: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
}

const light: ThemeColors = {
  brand: palette.brand[600],
  brandSoft: palette.brand[50],
  accent: palette.accent[600],
  surface: palette.surface.DEFAULT,
  surfaceMuted: palette.surface.muted,
  surfaceSubtle: palette.surface.subtle,
  ink: palette.ink.DEFAULT,
  inkSoft: palette.ink.soft,
  inkMuted: palette.ink.muted,
  inkFaint: palette.ink.faint,
  line: palette.line.DEFAULT,
  lineStrong: palette.line.strong,
  success: palette.success[600],
  successSoft: palette.success[50],
  warning: palette.warning[600],
  warningSoft: palette.warning[50],
  danger: palette.danger[600],
  dangerSoft: palette.danger[50],
};

const dark: ThemeColors = {
  brand: palette.brand[400],
  brandSoft: "#1e1b4b",
  accent: palette.accent[400],
  surface: palette.surface.inverse,
  surfaceMuted: "#1e293b",
  surfaceSubtle: "#334155",
  ink: "#f1f5f9",
  inkSoft: "#cbd5e1",
  inkMuted: "#94a3b8",
  inkFaint: "#64748b",
  line: "#334155",
  lineStrong: "#475569",
  success: palette.success[600],
  successSoft: "#052e22",
  warning: palette.warning[600],
  warningSoft: "#451a03",
  danger: palette.danger[600],
  dangerSoft: "#450a0a",
};

export function useTheme() {
  const scheme = useColorScheme();
  const mode = useSyncExternalStore(subscribe, () => themeMode);
  const isDark = mode === "dark" || (mode === "system" && scheme === "dark");
  const toggleTheme = () => setThemeMode(isDark ? "light" : "dark");
  return {
    colors: isDark ? dark : light,
    isDark,
    themeMode: mode,
    toggleTheme,
  };
}

export type Theme = ReturnType<typeof useTheme>;
