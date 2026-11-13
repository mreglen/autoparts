import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  fetchPlannerWeek,
  weekStartOf,
  type PlannerItem,
  type PlannerWeekResponse,
  type PlannerWeekZone,
} from "../api/planner";
import { describeError } from "../api/errors";
import {
  Screen,
  Sheet,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import {
  formatDayMonth,
  formatTime,
  normalizeOrderStatus,
  orderStatusLabel,
  toIsoDate,
} from "../utils/format";
import { orderStatusColor } from "../utils/orderStatusColors";

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const CELL_W = 64;
const ZONE_W = 104;
const MAX_CHIPS = 4;

function itemTime(item: PlannerItem): string {
  if (item.kind === "inspection") {
    return item.preferred_time?.slice(0, 5) || "—";
  }
  return formatTime(item.scheduled_at);
}

function itemMatches(item: PlannerItem, q: string): boolean {
  if (!q) return true;
  const hay = [
    item.client_name,
    item.vehicle,
    item.order_number,
    item.work_zone_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function inspectionDay(item: PlannerItem): string | null {
  if (item.kind !== "order" || !item.inspection_scheduled_at) return null;
  const d = new Date(item.inspection_scheduled_at);
  return Number.isNaN(d.getTime()) ? null : toIsoDate(d);
}

export function PlannerScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [data, setData] = useState<PlannerWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<{ fetchedAt: number } | null>(null);
  const [query, setQuery] = useState("");
  const [daySheet, setDaySheet] = useState<{
    zone: PlannerWeekZone;
    date: string;
  } | null>(null);

  const load = useCallback(
    async (ws: string, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await fetchPlannerWeek(ws);
        setData(result.data);
        setStale(result.stale ? { fetchedAt: result.fetchedAt } : null);
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
    const t = setTimeout(() => void load(weekStart), 0);
    return () => clearTimeout(t);
  }, [weekStart, load]);

  const q = query.trim().toLowerCase();

  const dayItems = useMemo(() => {
    if (!daySheet) return [];
    const day = daySheet.zone.days.find((d) => d.date === daySheet.date);
    return (day?.orders ?? []).filter((i) => itemMatches(i, q));
  }, [daySheet, q]);

  const shiftWeek = (days: number) => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + days);
    setWeekStart(weekStartOf(d));
  };

  const openItem = (item: PlannerItem) => {
    setDaySheet(null);
    if (item.kind === "inspection") {
      navigation.navigate("BookingDetail", { id: item.id });
    } else {
      navigation.navigate("OrderDetail", { id: item.id });
    }
  };

  const weekLabel = useMemo(() => {
    if (!data?.days.length) return "";
    const first = data.days[0].date;
    const last = data.days[data.days.length - 1].date;
    return `${formatDayMonth(first)} — ${formatDayMonth(last)}`;
  }, [data]);

  const todayIso = toIsoDate(new Date());

  return (
    <Screen
      onRefresh={() => void load(weekStart, true)}
      refreshing={refreshing}
    >
      {/* Шапка недели */}
      <View
        className="flex-row items-center justify-between px-4 pb-2 pt-2"
        style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}
      >
        <Pressable onPress={() => shiftWeek(-7)} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.inkSoft} />
        </Pressable>
        <View className="items-center">
          <Text className="text-sm font-semibold" style={{ color: colors.ink }}>
            {weekLabel || "Неделя"}
          </Text>
          <Pressable onPress={() => setWeekStart(weekStartOf(new Date()))}>
            <Text className="text-xs" style={{ color: colors.brand }}>
              Сегодня
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={() => shiftWeek(7)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.inkSoft} />
        </Pressable>
      </View>

      {/* Поиск */}
      <View className="px-4 py-2">
        <View
          className="flex-row items-center gap-2 rounded-xl px-3"
          style={{ backgroundColor: colors.surfaceSubtle, height: 40 }}
        >
          <Ionicons name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Клиент, авто, № заказа"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 text-sm"
            style={{ color: colors.ink }}
          />
        </View>
      </View>

      {stale ? <StaleDataBadge fetchedAt={stale.fetchedAt} /> : null}

      {loading ? (
        <View className="flex-1 px-4 pt-4">
          <SkeletonRows count={8} />
        </View>
      ) : !data ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm" style={{ color: colors.inkMuted }}>
            Не удалось загрузить планировщик
          </Text>
          <Pressable onPress={() => void load(weekStart)} className="mt-3">
            <Text
              className="text-sm font-medium"
              style={{ color: colors.brand }}
            >
              Повторить
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ width: ZONE_W + CELL_W * 7 }}>
              {/* Шапка дней */}
              <View className="flex-row">
                <View style={{ width: ZONE_W }} />
                {data.days.map((d) => {
                  const dt = new Date(`${d.date}T00:00:00`);
                  const isToday = d.date === todayIso;
                  return (
                    <View
                      key={d.date}
                      style={{
                        width: CELL_W,
                        alignItems: "center",
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        className="text-[10px] font-medium"
                        style={{ color: colors.inkMuted }}
                      >
                        {DAY_NAMES[(dt.getDay() + 6) % 7]}
                      </Text>
                      <Text
                        className="text-xs font-semibold"
                        style={{
                          color: isToday ? "#fff" : colors.ink,
                          backgroundColor: isToday
                            ? colors.brand
                            : "transparent",
                          borderRadius: 10,
                          overflow: "hidden",
                          paddingHorizontal: 6,
                        }}
                      >
                        {dt.getDate()}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Строки зон */}
              {data.zones.map((zone) => (
                <View key={zone.id ?? "unassigned"} className="flex-row">
                  <View
                    style={{
                      width: ZONE_W,
                      paddingLeft: 4,
                      paddingVertical: 6,
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: colors.inkSoft }}
                      numberOfLines={2}
                    >
                      {zone.name}
                    </Text>
                  </View>
                  {zone.days.map((day) => {
                    const items = day.orders.filter((i) => itemMatches(i, q));
                    const shown = items.slice(0, MAX_CHIPS);
                    const rest = items.length - shown.length;
                    return (
                      <Pressable
                        key={day.date}
                        onPress={() => setDaySheet({ zone, date: day.date })}
                        style={{
                          width: CELL_W,
                          minHeight: 44,
                          borderLeftWidth: 1,
                          borderTopWidth: 1,
                          borderColor: colors.line,
                          padding: 3,
                          gap: 2,
                          backgroundColor:
                            day.date === todayIso
                              ? colors.brandSoft
                              : "transparent",
                        }}
                      >
                        {shown.map((item, idx) => {
                          const inspDay = inspectionDay(item);
                          const isInspection = item.kind === "inspection";
                          const color = isInspection
                            ? colors.success
                            : orderStatusColor(colors, item.status);
                          return (
                            <View
                              key={`${item.kind}-${item.id}-${idx}`}
                              style={{
                                height: 10,
                                borderRadius: 3,
                                backgroundColor: color,
                                opacity: 0.85,
                                borderLeftWidth: inspDay === day.date ? 3 : 0,
                                borderLeftColor: colors.success,
                              }}
                            />
                          );
                        })}
                        {rest > 0 ? (
                          <Text
                            className="text-[9px]"
                            style={{ color: colors.inkMuted }}
                          >
                            +{rest}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Легенда */}
          <View className="mt-4 flex-row flex-wrap gap-x-4 gap-y-1 px-4">
            {(
              [
                ["pending", "Ожидание"],
                ["in_progress", "В работе"],
                ["done", "Выполнен"],
                ["completed", "Закрыт"],
              ] as const
            ).map(([s, label]) => (
              <View key={s} className="flex-row items-center gap-1">
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: orderStatusColor(colors, s),
                  }}
                />
                <Text
                  className="text-[10px]"
                  style={{ color: colors.inkMuted }}
                >
                  {label}
                </Text>
              </View>
            ))}
            <View className="flex-row items-center gap-1">
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  backgroundColor: colors.success,
                }}
              />
              <Text className="text-[10px]" style={{ color: colors.inkMuted }}>
                Осмотр
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Шторка дня */}
      <Sheet
        visible={daySheet != null}
        title={
          daySheet
            ? `${daySheet.zone.name} · ${formatDayMonth(daySheet.date)}`
            : ""
        }
        onClose={() => setDaySheet(null)}
      >
        <ScrollView className="max-h-96">
          {dayItems.length === 0 ? (
            <Text className="py-4 text-sm" style={{ color: colors.inkMuted }}>
              Нет записей на этот день
            </Text>
          ) : (
            dayItems.map((item) => {
              const isInspection = item.kind === "inspection";
              const status = normalizeOrderStatus(item.status);
              return (
                <Pressable
                  key={`${item.kind}-${item.id}`}
                  onPress={() => openItem(item)}
                  className="mb-2 rounded-xl p-3"
                  style={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      className="flex-1 text-sm font-medium"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {item.client_name}
                      {item.order_number ? ` · №${item.order_number}` : ""}
                    </Text>
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Text
                        className="text-[10px] font-medium"
                        style={{
                          color: isInspection
                            ? colors.success
                            : orderStatusColor(colors, status),
                        }}
                      >
                        {isInspection
                          ? "Осмотр"
                          : orderStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="mt-0.5 text-xs"
                    style={{ color: colors.inkMuted }}
                    numberOfLines={1}
                  >
                    {itemTime(item)} · {item.vehicle || "—"}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
