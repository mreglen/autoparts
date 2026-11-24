import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Easing, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../theme/useTheme";
import { DURATION, EASING } from "../../theme/motion";
import { hapticError, hapticSuccess } from "../../utils/haptics";
import { AppText as Text } from "./AppText";

interface ToastState {
  message: string;
  variant: "success" | "error" | "info";
}

interface ToastContextValue {
  show: (message: string, variant?: ToastState["variant"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback(
    (message: string, variant: ToastState["variant"] = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, variant });
      if (variant === "success") hapticSuccess();
      else if (variant === "error") hapticError();
      Animated.timing(opacity, {
        toValue: 1,
        duration: DURATION.fast,
        easing: Easing.bezier(...EASING.standard),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: DURATION.fast,
          easing: Easing.bezier(...EASING.exit),
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 4000);
    },
    [opacity],
  );

  const value = useMemo(() => ({ show }), [show]);

  const tone =
    toast?.variant === "success"
      ? colors.successSoft
      : toast?.variant === "error"
        ? colors.dangerSoft
        : colors.surfaceSubtle;
  const textTone =
    toast?.variant === "success"
      ? colors.success
      : toast?.variant === "error"
        ? colors.danger
        : colors.ink;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            right: 16,
            opacity,
          }}
        >
          <View
            className="flex-row items-center gap-2.5 rounded-2xl px-4 py-3"
            style={{ backgroundColor: tone }}
          >
            <Ionicons
              name={
                toast.variant === "success"
                  ? "checkmark-circle"
                  : toast.variant === "error"
                    ? "alert-circle"
                    : "information-circle"
              }
              size={18}
              color={textTone}
            />
            <Text
              className="flex-1 text-sm font-medium"
              style={{ color: textTone }}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast вне ToastProvider");
  return ctx;
}
