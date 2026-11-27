import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  fetchNotificationFeed,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "../api/notifications";
import { describeError } from "../api/errors";
import { useAppRole } from "../auth/roles";
import {
  FadeSlideIn,
  Screen,
  SearchField,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { plural } from "../utils/format";
import { resolveMobileNotificationTarget } from "../utils/notificationTarget";

function timeLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "только что";
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} ${plural(mins, "минуту", "минуты", "минут")} назад`;
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    return `${hours} ${plural(hours, "час", "часа", "часов")} назад`;
  }
  const day = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  return d.getFullYear() === new Date().getFullYear() ? day : `${day}.${d.getFullYear()}`;
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const { activeRole } = useAppRole();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const seenIdsRef = useRef<Set<number> | null>(null);

  // Сотрудник автосервиса видит только категорию autoservice; клиент — все.
  const categories = activeRole === "staff" ? "autoservice" : null;

  const load = useCallback(
    async (isRefresh = false, silent = false) => {
      if (isRefresh && !silent) setRefreshing(true);
      else if (!isRefresh) setLoading(true);
      try {
        const r = await fetchNotificationFeed(100, categories);
        const next = r.data?.items ?? [];
        if (seenIdsRef.current !== null) {
          const fresh = next.filter((n) => !seenIdsRef.current!.has(n.id));
          if (fresh.length > 0 && !fresh.every((n) => n.is_read)) {
            show(fresh[0].title, "info");
          }
        }
        seenIdsRef.current = new Set(next.map((n) => n.id));
        setItems(next);
        setUnread(r.data?.unread_count ?? 0);
        setStale(r.stale ? r.fetchedAt : null);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        if (!silent) setRefreshing(false);
      }
    },
    [categories, show],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
    const timer = setInterval(() => void load(true, true), 20_000);
    return () => clearInterval(timer);
  }, [load]);

  // Автоочистка подсветки через 2 секунды
  useEffect(() => {
    if (highlightId !== null) {
      const t = setTimeout(() => setHighlightId(null), 2000);
      return () => clearTimeout(t);
    }
  }, [highlightId]);

  // Сброс подсветки при уходе с экрана
  useFocusEffect(
    useCallback(() => {
      return () => {
        setHighlightId(null);
      };
    }, []),
  );

  const openItem = async (item: UserNotification) => {
    setHighlightId(item.id);
    if (!item.is_read) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(item.id);
      } catch {
        // read-флаг уже обновлён оптимистично
      }
    }
    const target = resolveMobileNotificationTarget(item, activeRole === "client");
    if (target) {
      const { screen, params } = target;
      if (screen === "Tab") {
        navigation.navigate("Main", { screen: params.tab! });
      } else if (screen === "ChatThread") {
        navigation.navigate("ChatThread", { chatId: params.chatId!, title: params.title });
      } else if (screen === "BookingDetail") {
        navigation.navigate("BookingDetail", { id: params.id! });
      } else if (screen === "OrderDetail") {
        navigation.navigate("OrderDetail", { id: params.id! });
      } else if (screen === "ClientOrder") {
        navigation.navigate("ClientOrder", { orderId: params.orderId! });
      }
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

  const q = query.trim().toLowerCase();
  const visibleItems = q
    ? items.filter((n) =>
        `${n.title} ${n.body ?? ""}`.toLowerCase().includes(q),
      )
    : items;

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
      {items.length > 0 ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по уведомлениям"
          className="mb-2"
        />
      ) : null}

      {unread > 0 ? (
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: colors.inkMuted }}>
            Непрочитанных: {unread}
          </Text>
          <Pressable onPress={() => void readAll()} disabled={busy}>
            <Text
              className="text-sm font-medium"
              style={{ color: colors.brand, opacity: busy ? 0.5 : 1 }}
            >
              Прочитать все
            </Text>
          </Pressable>
        </View>
      ) : null}

      {visibleItems.length === 0 ? (
        <Text className="py-10 text-center text-sm" style={{ color: colors.inkMuted }}>
          {q ? "Ничего не найдено" : "Уведомлений нет"}
        </Text>
      ) : (
        visibleItems.map((n, i) => (
          <FadeSlideIn key={n.id} index={i} style={{ marginTop: 8 }}>
            <Pressable
              onPress={() => void openItem(n)}
              className="flex-row rounded-xl px-4 py-3"
              style={{
                backgroundColor:
                  highlightId === n.id
                    ? `${colors.brand}20`
                    : colors.surfaceSubtle,
                borderLeftWidth: n.is_read ? 0 : 3,
                borderLeftColor: colors.brand,
              }}
            >
              <View className="min-w-0 flex-1">
                <Text
                  className={n.is_read ? "text-sm" : "text-sm font-semibold"}
                  style={{ color: n.is_read ? colors.inkSoft : colors.ink }}
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
                <Text className="mt-1 text-xs" style={{ color: colors.inkFaint }}>
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
