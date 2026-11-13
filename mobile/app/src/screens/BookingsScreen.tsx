import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  BOOKING_STATUS_LABELS,
  fetchBookings,
  type BookingStatus,
  type InspectionBooking,
} from "../api/bookings";
import { ApiError } from "../api/errors";
import { Screen, SkeletonRows, StaleDataBadge } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { formatDayMonth } from "../utils/format";

const FILTERS: { key: BookingStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "confirmed", label: "Подтверждённые" },
  { key: "processed", label: "Обработанные" },
  { key: "cancelled", label: "Отменённые" },
];

type SortKey = "created_at" | "preferred_date";

function statusColor(
  colors: ReturnType<typeof useTheme>["colors"],
  status?: string | null,
): string {
  switch (status) {
    case "new":
      return colors.warning;
    case "confirmed":
      return colors.brand;
    case "processed":
      return colors.success;
    default:
      return colors.inkMuted;
  }
}

function statusSoft(
  colors: ReturnType<typeof useTheme>["colors"],
  status?: string | null,
): string {
  switch (status) {
    case "new":
      return colors.warningSoft;
    case "confirmed":
      return colors.brandSoft;
    case "processed":
      return colors.successSoft;
    default:
      return colors.surfaceSubtle;
  }
}

export function BookingsScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<InspectionBooking[] | null>(null);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staleAt, setStaleAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchBookings({
        status: filter === "all" ? undefined : filter,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setItems(result.data);
      setStaleAt(result.fromCache ? result.fetchedAt : null);
      setError("");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Не удалось загрузить записи",
      );
      setItems((prev) => prev ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, sortBy, sortDir]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка и смена фильтров
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const sortedHint = useMemo(
    () => (sortBy === "preferred_date" ? "По дате записи" : "По дате создания"),
    [sortBy],
  );

  return (
    <Screen scroll={false}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-lg font-semibold" style={{ color: colors.ink }}>
          Записи на осмотр
        </Text>
        {staleAt ? <StaleDataBadge fetchedAt={staleAt} /> : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2"
        contentContainerStyle={{ gap: 6 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className="rounded-full px-3 py-1.5"
              style={{
                backgroundColor: active ? colors.brand : colors.surfaceSubtle,
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: active ? "#fff" : colors.inkSoft }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => {
          if (sortBy === "created_at" && sortDir === "desc") {
            setSortBy("preferred_date");
            setSortDir("asc");
          } else if (sortBy === "preferred_date" && sortDir === "asc") {
            setSortBy("preferred_date");
            setSortDir("desc");
          } else {
            setSortBy("created_at");
            setSortDir("desc");
          }
        }}
        className="mb-3 flex-row items-center gap-1 self-start"
      >
        <Ionicons name="swap-vertical" size={14} color={colors.inkMuted} />
        <Text className="text-xs" style={{ color: colors.inkMuted }}>
          {sortedHint}
          {sortDir === "asc" ? " ↑" : " ↓"}
        </Text>
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.brand}
          />
        }
      >
        {loading ? (
          <SkeletonRows count={6} />
        ) : error && (!items || items.length === 0) ? (
          <View className="items-center gap-3 pt-10">
            <Ionicons
              name="cloud-offline-outline"
              size={40}
              color={colors.inkFaint}
            />
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              {error}
            </Text>
          </View>
        ) : !items || items.length === 0 ? (
          <View className="items-center gap-3 pt-10">
            <Ionicons
              name="calendar-clear-outline"
              size={40}
              color={colors.inkFaint}
            />
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              Записей нет
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  navigation.navigate("BookingDetail", { id: item.id })
                }
                className="flex-row items-center gap-3 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: statusSoft(colors, item.status),
                      }}
                    >
                      <Text
                        className="text-[10px] font-medium"
                        style={{ color: statusColor(colors, item.status) }}
                      >
                        {BOOKING_STATUS_LABELS[item.status] ?? item.status}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="mt-0.5 text-xs"
                    style={{ color: colors.inkMuted }}
                    numberOfLines={1}
                  >
                    {formatDayMonth(item.preferred_date)}
                    {item.preferred_time
                      ? ` ${String(item.preferred_time).slice(0, 5)}`
                      : ""}
                    {item.vehicle_make || item.vehicle_model
                      ? ` · ${[item.vehicle_make, item.vehicle_model].filter(Boolean).join(" ")}`
                      : item.vehicle
                        ? ` · ${item.vehicle.make ?? ""} ${item.vehicle.model ?? ""}`.trim()
                        : ""}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.inkFaint}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Кнопка создания — правая нижняя, как «+ Добавить» в форме заказа-наряда */}
      <Pressable
        onPress={() => navigation.navigate("BookingNew")}
        className="absolute bottom-4 right-4 h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.brand }}
        accessibilityLabel="Новая запись"
      >
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>
    </Screen>
  );
}
