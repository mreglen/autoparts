import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { cachedGet, type CachedResult } from "../offline";
import { ApiError, describeError } from "../api/errors";
import {
  AppHeader,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
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
import { AppText as Text } from "../components/ui/AppText";

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
    });
  }
  if ((summary.new_bookings ?? 0) > 0) {
    tiles.push({
      label: "Новые записи",
      value: String(summary.new_bookings),
      hint: "Требуют подтверждения",
      icon: "calendar-outline",
      accent: "warning",
    });
  }
  if (Number(summary.debt_total) > 0) {
    tiles.push({
      label: "Дебит клиентов",
      value: formatMoney(summary.debt_total),
      hint: `${summary.debtors_count ?? 0} ${plural(summary.debtors_count ?? 0, "клиент", "клиента", "клиентов")}`,
      icon: "card-outline",
      accent: "danger",
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
    });
  }
  if (summary.revenue_30d != null) {
    tiles.push({
      label: "Выручка за 30 дней",
      value: formatMoney(summary.revenue_30d),
      icon: "trending-up-outline",
      accent: "success",
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

  const handleItemPress = (item: TodayItem) => {
    if (item.kind === "inspection") {
      navigation.navigate("BookingDetail", { id: item.id });
    } else {
      navigation.navigate("OrderDetail", { id: item.id });
    }
  };

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing}>
      <AppHeader
        title={greeting}
        subtitle="Рабочий стол автосервиса"
        right={stale ? <StaleDataBadge fetchedAt={stale.fetchedAt} /> : null}
      />

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
          <Button
            title="Повторить"
            variant="secondary"
            onPress={() => {
              setLoading(true);
              void load();
            }}
          />
        </View>
      ) : summary ? (
        <View className="gap-5">
          {tiles.length > 0 ? (
            <View>
              <SectionHeader title="Требует внимания" />
              <View className="flex-row flex-wrap gap-2">
                {tiles.map((tile) => (
                  <Card
                    key={tile.label}
                    padded={false}
                    className="min-w-[46%] flex-1"
                  >
                    <View className="p-3">
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
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          {payroll ? (
            <View>
              <SectionHeader title="Моя зарплата" />
              <Card>
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.ink }}
                >
                  {formatMoney(payroll.total)}
                </Text>
              </Card>
              <Text
                className="mt-1.5 text-xs"
                style={{ color: colors.inkMuted }}
              >
                Начислено за {payroll.month}.{payroll.year} ·{" "}
                {payroll.completed_orders}{" "}
                {plural(payroll.completed_orders, "заказ", "заказа", "заказов")}
              </Text>
            </View>
          ) : null}

          <View>
            <SectionHeader
              title={
                summary.level === "own" ? "Мои заказы сегодня" : "Сегодня"
              }
            />
            {todayItems.length === 0 ? (
              <EmptyState
                icon="calendar-clear-outline"
                title="Записей нет"
              />
            ) : (
              <View className="gap-2">
                {todayItems.map((item) => (
                  <PressableScale
                    key={`${item.kind}-${item.id}`}
                    onPress={() => handleItemPress(item)}
                  >
                    <Card padded={false}>
                      <View className="flex-row items-center gap-3 p-3.5">
                        <View className="w-12">
                          <Text
                            className="text-sm font-semibold"
                            style={{ color: colors.ink }}
                          >
                            {formatTime(item.scheduled_at) || "—"}
                          </Text>
                        </View>
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
                            {item.work_zone_name
                              ? ` · ${item.work_zone_name}`
                              : ""}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.inkFaint}
                        />
                      </View>
                    </Card>
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
