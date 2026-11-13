// Этот файл сгенерирован scripts/sync-theme.mjs — не правьте вручную.
// Источник: ../../frontend/my-autoparts/tailwind.config.js

export const palette = {
  brand: {
    "50": "#eef2ff",
    "100": "#e0e7ff",
    "200": "#c7d2fe",
    "300": "#a5b4fc",
    "400": "#818cf8",
    "500": "#6366f1",
    "600": "#4f46e5",
    "700": "#4338ca",
    "800": "#3730a3",
    "900": "#312e81",
    DEFAULT: "#4f46e5",
  },
  accent: {
    "50": "#fff7ed",
    "100": "#ffedd5",
    "200": "#fed7aa",
    "300": "#fdba74",
    "400": "#fb923c",
    "500": "#f97316",
    "600": "#ea580c",
    "700": "#c2410c",
    DEFAULT: "#ea580c",
  },
  surface: {
    DEFAULT: "#ffffff",
    muted: "#f8fafc",
    subtle: "#f1f5f9",
    inverse: "#0f172a",
  },
  ink: {
    DEFAULT: "#0f172a",
    soft: "#334155",
    muted: "#64748b",
    faint: "#94a3b8",
  },
  line: {
    DEFAULT: "#e2e8f0",
    strong: "#cbd5e1",
    soft: "#f1f5f9",
  },
  success: {
    "50": "#ecfdf5",
    "100": "#d1fae5",
    "600": "#059669",
    "700": "#047857",
    DEFAULT: "#059669",
  },
  warning: {
    "50": "#fffbeb",
    "100": "#fef3c7",
    "600": "#d97706",
    "700": "#b45309",
    DEFAULT: "#d97706",
  },
  danger: {
    "50": "#fef2f2",
    "100": "#fee2e2",
    "600": "#dc2626",
    "700": "#b91c1c",
    DEFAULT: "#dc2626",
  },
  brown_primary: {
    light: "#A0673A",
    middle: "#A0673A",
    dark: "#884517",
  },
  green_primary: {
    light: "#A0673A",
    middle: "#38700B",
    dark: "#884517",
  },
} as const;

/** Шкала размеров текста в px: text-sg-* из веб-конфига. */
export const fontSizePx = {
  display: 36,
  title: 24,
  subtitle: 18,
  body: 15,
  caption: 13,
} as const;

export const typography = {
  display: {
    fontSize: 36,
    lineHeight: 41.4,
    letterSpacing: -0.72,
    fontWeight: "700",
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.36,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 25.2,
    fontWeight: "600",
  },
  body: {
    fontSize: 15,
    lineHeight: 23.25,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18.2,
  },
} as const;

export const radius = {
  sm: 8,
  base: 12,
  lg: 16,
} as const;
