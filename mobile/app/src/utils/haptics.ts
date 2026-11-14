/** Тактильная отдача через expo-haptics. Модуль подгружается лениво:
 *  в jest/node-окружении нативного модуля нет — вызовы тихо пропускаются. */

/* eslint-disable @typescript-eslint/no-require-imports */

export type HapticKind = "light" | "medium" | "success" | "error" | "selection";

function haptics() {
  try {
    return require("expo-haptics") as typeof import("expo-haptics");
  } catch {
    return null;
  }
}

export function haptic(kind: HapticKind = "light"): void {
  const H = haptics();
  if (!H) return;
  try {
    switch (kind) {
      case "light":
        void H.impactAsync(H.ImpactFeedbackStyle.Light);
        break;
      case "medium":
        void H.impactAsync(H.ImpactFeedbackStyle.Medium);
        break;
      case "selection":
        void H.selectionAsync();
        break;
      case "success":
        void H.notificationAsync(H.NotificationFeedbackType.Success);
        break;
      case "error":
        void H.notificationAsync(H.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Нативный модуль недоступен — молча пропускаем.
  }
}

export const hapticLight = () => haptic("light");
export const hapticMedium = () => haptic("medium");
export const hapticSelection = () => haptic("selection");
export const hapticSuccess = () => haptic("success");
export const hapticError = () => haptic("error");
