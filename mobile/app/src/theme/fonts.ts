import { useFonts } from "expo-font";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

export const fontFamily = {
  regular: "GolosText-Regular",
  medium: "GolosText-Medium",
  semibold: "GolosText-SemiBold",
  bold: "GolosText-Bold",
} as const;

export type FontWeightName = keyof typeof fontFamily;

const fontAssets = {
  [fontFamily.regular]: require("../../assets/fonts/GolosText-Regular.ttf"),
  [fontFamily.medium]: require("../../assets/fonts/GolosText-Medium.ttf"),
  [fontFamily.semibold]: require("../../assets/fonts/GolosText-SemiBold.ttf"),
  [fontFamily.bold]: require("../../assets/fonts/GolosText-Bold.ttf"),
} as const;

let fontsReady = false;

export function fontsLoaded(): boolean {
  return fontsReady;
}

/** Загружает Golos Text; возвращает true, когда шрифты готовы. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts(fontAssets);
  useEffect(() => {
    if (loaded) fontsReady = true;
  }, [loaded]);
  return loaded;
}

const CLASS_WEIGHT: Record<string, number> = {
  "font-thin": 100,
  "font-extralight": 200,
  "font-light": 300,
  "font-normal": 400,
  "font-medium": 500,
  "font-semibold": 600,
  "font-bold": 700,
  "font-extrabold": 800,
  "font-black": 900,
};

function weightToNumber(weight: unknown): number {
  if (weight == null) return 400;
  if (weight === "bold") return 700;
  if (weight === "normal") return 400;
  const n = Number(weight);
  return Number.isFinite(n) ? n : 400;
}

function weightFromClassName(className: unknown): number | null {
  if (typeof className !== "string") return null;
  let found: number | null = null;
  for (const cls of className.split(/\s+/)) {
    const w = CLASS_WEIGHT[cls];
    if (w != null) found = w;
  }
  return found;
}

/** Семейство Golos Text под заданный вес; null — шрифт не применяем. */
export function fontFamilyForWeight(
  weight: unknown,
  className?: unknown,
): string | null {
  if (!fontsReady) return null;
  const w = weightToNumber(weight ?? weightFromClassName(className));
  if (w >= 700) return fontFamily.bold;
  if (w >= 600) return fontFamily.semibold;
  if (w >= 500) return fontFamily.medium;
  return fontFamily.regular;
}

/** fontFamily из style-пропа (flatten), если задан явно. */
export function explicitFontFamily(style: unknown): string | null {
  const flat = StyleSheet.flatten(style as never) as
    | { fontFamily?: unknown }
    | undefined;
  const ff = flat?.fontFamily;
  return typeof ff === "string" && ff ? ff : null;
}

/** fontWeight из style-пропа (flatten). */
export function styleFontWeight(style: unknown): unknown {
  const flat = StyleSheet.flatten(style as never) as
    | { fontWeight?: unknown }
    | undefined;
  return flat?.fontWeight;
}
