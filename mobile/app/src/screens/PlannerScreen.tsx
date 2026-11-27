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
} from "../api/planner";
import { describeError } from "../api/errors";
import {
  DatePickerButton,
  Screen,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import {
  formatTime,
  normalizeOrderStatus,
  orderStatusLabel,
  toIsoDate,
} from "../utils/format";
import { orderStatusColor } from "../utils/orderStatusColors";

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

function isInspectionOnDate(item: PlannerItem, dateIso: string): boolean {
  if (item.kind === "inspection") {
    return item.scheduled_at.startsWith(dateIso);
  }
  if (item.inspection_scheduled_at) {
    return item.inspection_scheduled_at.startsWith(dateIso);
  }
  return false;
}

export function PlannerScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekData, setWeekData] = useState<PlannerWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<{ fetchedAt: number } | null>(null);
  const [query, setQuery] = useState("");

  const selectedDateIso = toIsoDate(selectedDate);
  const weekStart = weekStartOf(selectedDate);

  const load = useCallback(
    async (ws: string, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await fetchPlannerWeek(ws);
        setWeekData(result.data);
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

  const visibleItems = useMemo(() => {
    if (!weekData) return [];
    const allItems: PlannerItem[] = [];
    for (const zone of weekData.zones) {
      for (const day of zone.days) {
        if (day.date === selectedDateIso) {
          allItems.push(...day.orders);
        }
      }
    }
    return allItems.filter((i) => itemMatches(i, q));
  }, [weekData, selectedDateIso, q]);

  const shiftDay = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
  };

  const openItem = (item: PlannerItem) => {
    if (item.kind === "inspection") {
      navigation.navigate("BookingDetail", { id: item.id });
    } else {
      navigation.navigate("OrderDetail", { id: item.id });
    }
  };

  return (
    <Screen
      onRefresh={() => void load(weekStart, true)}
      refreshing={refreshing}
    >
      {/* Шапка с датой и стрелками */}
      <View
        className="flex-row items-center justify-between px-4 pb-2 pt-2"
        style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}
      >
        <Pressable onPress={() => shiftDay(-1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.inkSoft} />
        </Pressable>
        <DatePickerButton
          value={selectedDate}
          onChange={setSelectedDate}
        />
        <Pressable onPress={() => shiftDay(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.inkSoft} />
        </Pressable>
      </View>

      {/* Кнопка сегодня */}
      <View className="px-4 py-2">
        <Pressable onPress={() => setSelectedDate(new Date())}>
          <Text className="text-sm" style={{ color: colors.brand }}>
            Сегодня
          </Text>
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
      ) : !weekData ? (
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
      ) : visibleItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm" style={{ color: colors.inkMuted }}>
            {q ? "Ничего не найдено" : "Нет записей на этот день"}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-2">
          {visibleItems.map((item) => {
            const isInspection = item.kind === "inspection";
            const status = normalizeOrderStatus(item.status);
            const hasInspectionOnDate = isInspectionOnDate(
              item,
              selectedDateIso,
            );
            return (
              <Pressable
                key={`${item.kind}-${item.id}`}
                onPress={() => openItem(item)}
                className="mb-2 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-2">
                    {hasInspectionOnDate && (
                      <Ionicons
                        name="eye"
                        size={14}
                        color={colors.success}
                      />
                    )}
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {item.client_name}
                      {item.order_number ? ` · №${item.order_number}` : ""}
                    </Text>
                  </View>
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
          })}
        </ScrollView>
      )}
    </Screen>
  );
}
