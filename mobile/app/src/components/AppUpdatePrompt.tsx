import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { useSession } from "../auth/session";
import { useTheme } from "../theme/useTheme";
import { useToast } from "./ui";
import {
  checkForUpdate,
  dismissUpdate,
  downloadApk,
  onManualUpdateCheck,
  shareApk,
  type UpdateInfo,
} from "../app/appUpdate";

export function AppUpdatePrompt() {
  const { status } = useSession();
  const { colors } = useTheme();
  const { show } = useToast();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  const runCheck = useCallback(
    async (manual: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const result = await checkForUpdate({ ignoreDismissed: manual });
        if (result) {
          setError("");
          setInfo(result);
        } else if (manual) {
          show("Установлена последняя версия", "success");
        }
      } finally {
        busyRef.current = false;
      }
    },
    [show],
  );

  useEffect(() => {
    if (status !== "signedIn") return;
    void runCheck(false);
    return onManualUpdateCheck(() => void runCheck(true));
  }, [status, runCheck]);

  const onLater = useCallback(() => {
    if (info) void dismissUpdate(info.version);
    setInfo(null);
  }, [info]);

  const onUpdate = useCallback(async () => {
    if (!info || progress !== null) return;
    setError("");
    setProgress(0);
    try {
      const uri = await downloadApk(info.url, info.version, setProgress);
      setProgress(null);
      await shareApk(uri);
    } catch {
      setProgress(null);
      setError(
        "Не удалось скачать обновление. Проверьте соединение и попробуйте ещё раз.",
      );
    }
  }, [info, progress]);

  if (!info) return null;
  const force = info.kind === "force";
  const downloading = progress !== null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={force ? undefined : onLater}
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View
          className="w-full max-w-sm rounded-2xl p-5"
          style={{ backgroundColor: colors.surface }}
        >
          <Text className="text-lg font-semibold" style={{ color: colors.ink }}>
            {force ? "Требуется обновление" : "Доступно обновление"}
          </Text>
          <Text className="mt-1 text-sm" style={{ color: colors.inkMuted }}>
            Версия {info.version}
            {info.notes ? ` — ${info.notes}` : ""}
          </Text>
          {downloading ? (
            <View className="mt-4">
              <View
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: colors.brand,
                    width: `${Math.round(progress * 100)}%`,
                  }}
                />
              </View>
              <Text className="mt-2 text-xs" style={{ color: colors.inkMuted }}>
                Загрузка… {Math.round(progress * 100)}%
              </Text>
            </View>
          ) : null}
          {error ? (
            <Text className="mt-3 text-sm" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}
          <View className="mt-5 flex-row justify-end gap-3">
            {!force ? (
              <Pressable
                onPress={onLater}
                disabled={downloading}
                className="rounded-xl px-4 py-2.5"
              >
                <Text
                  className="font-medium"
                  style={{ color: colors.inkMuted }}
                >
                  Позже
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void onUpdate()}
              disabled={downloading}
              className="rounded-xl px-4 py-2.5"
              style={{ backgroundColor: colors.brand }}
            >
              <Text className="font-semibold text-white">
                {downloading ? "Загрузка…" : "Обновить"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
