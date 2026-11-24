import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import {
  fetchNotificationFeed,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "../api/notifications";
import { describeError } from "../api/errors";
import {
  Button,
  EmptyState,
  FadeSlideIn,
  Screen,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import { cardChrome } from "../components/ui/chrome";
import { useTheme } from "../theme/useTheme";
import { formatDayMonth } from "../utils/format";
import { AppText as Text } from "../components/ui/AppText";

function timeLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = formatDayMonth(value);
  const time = d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return day ? `${day} ${time}` : time;
}

export function ClientNotificationsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const r = await fetchNotificationFeed(100);
        setItems(r.data?.items ?? []);
        setUnread(r.data?.unread_count ?? 0);
        setStale(r.stale ? r.fetchedAt : null);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
  }, [load]);

  const openItem = async (item: UserNotification) => {
    if (item.is_read) return;
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(item.id);
    } catch {
      // read-флаг уже обновлён оптимистично; при ошибке догрузим при следующем refresh
    }
  };

  const readAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <SkeletonRows count={5} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      {stale != null ? <StaleDataBadge fetchedAt={stale} /> : null}
      {unread > 0 ? (
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: colors.inkMuted }}>
            Непрочитанных: {unread}
          </Text>
          <Button
            title="Прочитать все"
            variant="ghost"
            compact
            loading={busy}
            onPress={() => void readAll()}
          />
        </View>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Уведомлений нет"
          message="Статусы записей и заказ-нарядов будут появляться здесь."
        />
      ) : (
        items.map((n, i) => (
          <FadeSlideIn key={n.id} index={i} style={{ marginTop: 8 }}>
            <Pressable
              onPress={() => void openItem(n)}
              className="flex-row rounded-xl px-4 py-3"
              style={[
                cardChrome(colors),
                {
                  borderLeftWidth: n.is_read ? 0 : 3,
                  borderLeftColor: colors.brand,
                },
              ]}
            >
              <View className="min-w-0 flex-1">
                <Text
                  className={n.is_read ? "text-sm" : "text-sm font-semibold"}
                  style={{
                    color: n.is_read ? colors.inkSoft : colors.ink,
                  }}
                  numberOfLines={2}
                >
                  {n.title}
                </Text>
                {n.body ? (
                  <Text
                    className="mt-0.5 text-sm"
                    style={{ color: colors.inkMuted }}
                    numberOfLines={3}
                  >
                    {n.body}
                  </Text>
                ) : null}
                <Text
                  className="mt-1 text-xs"
                  style={{ color: colors.inkFaint }}
                >
                  {timeLabel(n.created_at)}
                </Text>
              </View>
              {!n.is_read ? (
                <View
                  className="ml-2 mt-1 h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors.brand }}
                />
              ) : null}
            </Pressable>
          </FadeSlideIn>
        ))
      )}
    </Screen>
  );
}
