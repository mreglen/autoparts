import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { cachedGet, type CachedResult } from "../offline";
import { ApiError, describeError } from "../api/errors";
import {
  Screen,
  SkeletonRows,
  StaleDataBadge,
  PressableScale,
} from "../components/ui";
import {
  formatMoney,
  formatTime,
  greetingByHour,
  orderStatusLabel,
  plural,
} from "../utils/format";
import { orderStatusColor, orderStatusSoft } from "../utils/orderStatusColors";
import { useTheme } from "../theme/useTheme";

interface PayrollBlock {
  year: number;
  month: number;
  total: number;
  completed_orders: number;
}

interface TodayItem {
  id: number;
  kind: "order" | "inspection";
  order_number?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  vehicle?: string | null;
  status?: string | null;
  scheduled_at?: string | null;
  work_zone_name?: string | null;
  notes?: string | null;
}

interface DashboardSummary {
  level?: string | null;
  active_orders?: number | null;
  in_progress_orders?: number | null;
  review_orders?: number | null;
  new_bookings?: number | null;
  debt_total?: number | null;
  debtors_count?: number | null;
  revenue_30d?: number | null;
  payroll_month?: PayrollBlock | null;
  today?: TodayItem[];
}

interface Tile {
  label: string;
  value: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: "warning" | "brand" | "danger" | "success";
  /** Метод навигации при клике на плитку */
  action?: "bookings" | "clients" | "orders" | "orders-in-progress" | "reports";
}

function buildTiles(summary: DashboardSummary): Tile[] {
  const tiles: Tile[] = [];
  if ((summary.review_orders ?? 0) > 0) {
    tiles.push({
      label: "На проверке",
      value: String(summary.review_orders),
      hint: plural(summary.review_orders ?? 0, "заказ", "заказа", "заказов"),
      icon: "alert-circle-outline",
      accent: "warning",
      action: "orders",
    });
  }
  if ((summary.new_bookings ?? 0) > 0) {
    tiles.push({
      label: "Новые записи",
      value: String(summary.new_bookings),
      hint: "Требуют подтверждения",
      icon: "calendar-outline",
      accent: "warning",
      action: "bookings",
    });
  }
  if (Number(summary.debt_total) > 0) {
    tiles.push({
      label: "Дебит клиентов",
      value: formatMoney(summary.debt_total),
      hint: `${summary.debtors_count ?? 0} ${plural(summary.debtors_count ?? 0, "клиент", "клиента", "клиентов")}`,
      icon: "card-outline",
      accent: "danger",
      action: "clients",
    });
  }
  if (summary.in_progress_orders != null) {
    tiles.push({
      label: "В работе",
      value: String(summary.in_progress_orders),
      hint:
        summary.level === "own"
          ? "Мои заказы"
          : `${summary.active_orders ?? 0} активных`,
      icon: "construct-outline",
      accent: "brand",
      action: "orders-in-progress",
    });
  }
  if (summary.revenue_30d != null) {
    tiles.push({
      label: "Выручка за 30 дней",
      value: formatMoney(summary.revenue_30d),
      icon: "trending-up-outline",
      accent: "success",
      action: "reports",
    });
  }
  return tiles;
}

export function TodayScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState<CachedResult<DashboardSummary> | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const result = await cachedGet<DashboardSummary>(
        "/autoservice/dashboard/summary",
      );
      setSummary(result.data);
      setStale(result.fromCache ? result : null);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.kind === "http") {
        setError(describeError(e));
      } else {
        setError("Нет соединения и нет сохранённых данных");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка данных экрана
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const greeting = greetingByHour(new Date().getHours());
  const tiles = summary ? buildTiles(summary) : [];
  const todayItems = summary?.today ?? [];
  const payroll = summary?.payroll_month ?? null;

  const handleTilePress = (tile: Tile) => {
    switch (tile.action) {
      case "bookings":
        navigation.jumpTo("Bookings");
        break;
      case "clients":
        navigation.navigate("Clients");
        break;
      case "orders":
      case "orders-in-progress":
        navigation.jumpTo("Orders");
        break;
      case "reports":
        navigation.navigate("Reports");
        break;
      default:
        break;
    }
  };

  const handleItemPress = (item: TodayItem) => {
    if (item.kind === "inspection") {
      navigation.navigate("BookingDetail", { id: item.id });
    } else {
      navigation.navigate("OrderDetail", { id: item.id });
    }
  };

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <View className="mb-4 flex-row items-start justify-between">
        <View>
          <Text className="text-2xl font-bold" style={{ color: colors.ink }}>
            {greeting}
          </Text>
          <Text className="mt-0.5 text-sm" style={{ color: colors.inkMuted }}>
            Рабочий стол автосервиса
          </Text>
        </View>
        {stale ? <StaleDataBadge fetchedAt={stale.fetchedAt} /> : null}
      </View>

      {loading ? (
        <SkeletonRows count={4} />
      ) : error && !summary ? (
        <View className="items-center gap-3 pt-10">
          <Ionicons
            name="cloud-offline-outline"
            size={40}
            color={colors.inkFaint}
          />
          <Text className="text-sm" style={{ color: colors.inkMuted }}>
            {error}
          </Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              void load();
            }}
            className="rounded-xl px-4 py-2.5"
            style={{ backgroundColor: colors.brandSoft }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: colors.brand }}
            >
              Повторить
            </Text>
          </Pressable>
        </View>
      ) : summary ? (
        <View className="gap-5">
          {tiles.length > 0 ? (
            <View>
              <Text
                className="mb-2 text-xs font-semibold uppercase"
                style={{ color: colors.inkMuted }}
              >
                Требует внимания
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {tiles.map((tile) => (
                  <PressableScale
                    key={tile.label}
                    onPress={() => handleTilePress(tile)}
                    className="min-w-[46%] flex-1 rounded-xl p-3"
                    style={{ backgroundColor: colors.surfaceSubtle }}
                  >
                    <View className="flex-row items-center justify-between gap-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons
                          name={tile.icon}
                          size={14}
                          color={
                            tile.accent === "warning"
                              ? colors.warning
                              : tile.accent === "danger"
                                ? colors.danger
                                : tile.accent === "success"
                                  ? colors.success
                                  : colors.brand
                          }
                        />
                        <Text
                          className="text-xs"
                          style={{ color: colors.inkMuted }}
                          numberOfLines={1}
                        >
                          {tile.label}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={colors.inkFaint}
                      />
                    </View>
                    <Text
                      className="mt-1 text-xl font-bold"
                      style={{ color: colors.ink }}
                    >
                      {tile.value}
                    </Text>
                    {tile.hint ? (
                      <Text
                        className="text-xs"
                        style={{ color: colors.inkFaint }}
                        numberOfLines={1}
                      >
                        {tile.hint}
                      </Text>
                    ) : null}
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

          {payroll ? (
            <PressableScale onPress={() => navigation.navigate("Finance")}>
              <Text
                className="mb-2 text-xs font-semibold uppercase"
                style={{ color: colors.inkMuted }}
              >
                Моя зарплата
              </Text>
              <View
                className="flex-row items-center justify-between rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.ink }}
                >
                  {formatMoney(payroll.total)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.inkMuted}
                />
              </View>
              <Text
                className="mt-0.5 text-xs"
                style={{ color: colors.inkMuted }}
              >
                Начислено за {payroll.month}.{payroll.year} ·{" "}
                {payroll.completed_orders}{" "}
                {plural(payroll.completed_orders, "заказ", "заказа", "заказов")}
              </Text>
            </PressableScale>
          ) : null}

          <View>
            <Text
              className="mb-2 text-xs font-semibold uppercase"
              style={{ color: colors.inkMuted }}
            >
              {summary.level === "own" ? "Мои заказы сегодня" : "Сегодня"}
            </Text>
            {todayItems.length === 0 ? (
              <View
                className="items-center rounded-xl p-6"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <Ionicons
                  name="calendar-clear-outline"
                  size={32}
                  color={colors.inkFaint}
                />
                <Text
                  className="mt-2 text-sm"
                  style={{ color: colors.inkMuted }}
                >
                  Записей нет
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {todayItems.map((item) => (
                  <PressableScale
                    key={`${item.kind}-${item.id}`}
                    onPress={() => handleItemPress(item)}
                    className="flex-row items-center gap-3 rounded-xl p-3"
                    style={{ backgroundColor: colors.surfaceSubtle }}
                  >
                    <Text
                      className="w-12 text-sm font-semibold"
                      style={{ color: colors.ink }}
                    >
                      {formatTime(item.scheduled_at) || "—"}
                    </Text>
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text
                          className="text-sm font-medium"
                          style={{ color: colors.ink }}
                          numberOfLines={1}
                        >
                          {item.client_name || "—"}
                        </Text>
                        <View
                          className="rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: orderStatusSoft(
                              colors,
                              item.status,
                            ),
                          }}
                        >
                          <Text
                            className="text-[10px] font-medium"
                            style={{
                              color: orderStatusColor(colors, item.status),
                            }}
                          >
                            {orderStatusLabel(item.status)}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: colors.inkMuted }}
                        numberOfLines={1}
                      >
                        {item.kind === "inspection"
                          ? "Осмотр"
                          : `Заказ-наряд №${item.order_number ?? "—"}`}
                        {item.vehicle ? ` · ${item.vehicle}` : ""}
                        {item.work_zone_name ? ` · ${item.work_zone_name}` : ""}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.inkMuted}
                    />
                  </PressableScale>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
