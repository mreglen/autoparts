import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  fetchClientsPage,
  type ClientPageRow,
  type PageResponse,
} from "../api/directory";
import { fetchClientVehicles, type FormVehicle } from "../api/orderForm";
import { describeError } from "../api/errors";
import {
  Screen,
  Sheet,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { formatDayMonth, formatMoney } from "../utils/format";
import { useTheme } from "../theme/useTheme";

type Props = NativeStackScreenProps<RootStackParamList, "Clients">;

export function ClientsScreen(_: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ClientPageRow[]>([]);
  const [page, setPage] = useState<PageResponse<ClientPageRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [selected, setSelected] = useState<ClientPageRow | null>(null);
  const [vehicles, setVehicles] = useState<FormVehicle[] | null>(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (isRefresh = false, q = query) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const r = await fetchClientsPage({ q: q || undefined, limit: 50 });
        setRows(r.data.items);
        setPage(r.data);
        setStale(r.stale ? r.fetchedAt : null);
        offsetRef.current = r.data.items.length;
        hasMoreRef.current = r.data.has_more;
        setHasMore(r.data.has_more);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, show],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(false, query), 400);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    try {
      const r = await fetchClientsPage({
        q: query || undefined,
        limit: 50,
        offset: offsetRef.current,
      });
      setRows((prev) => [...prev, ...r.data.items]);
      offsetRef.current += r.data.items.length;
      hasMoreRef.current = r.data.has_more;
      setHasMore(r.data.has_more);
      setStale(r.stale ? r.fetchedAt : null);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const openClient = async (client: ClientPageRow) => {
    setSelected(client);
    setVehicles(null);
    try {
      setVehicles((await fetchClientVehicles(client.id)).data);
    } catch {
      setVehicles([]);
    }
  };

  const num = (v: number | string | undefined | null) =>
    v == null ? 0 : Number(v);

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <View className="mb-3 flex-row items-center gap-2">
        <View
          className="flex-1 flex-row items-center gap-2 rounded-xl px-3"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Ionicons name="search" size={16} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Имя или телефон"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 py-2.5 text-sm"
            style={{ color: colors.ink }}
          />
        </View>
        <StaleDataBadge fetchedAt={stale} />
      </View>

      {loading ? (
        <SkeletonRows count={8} />
      ) : rows.length === 0 ? (
        <Text
          className="py-8 text-center text-sm"
          style={{ color: colors.inkMuted }}
        >
          Клиенты не найдены
        </Text>
      ) : (
        <View className="gap-2">
          {rows.map((c) => {
            const debt = num(c.debt_amount);
            return (
              <Pressable
                key={c.id}
                onPress={() => void openClient(c)}
                className="rounded-2xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="flex-1 text-sm font-semibold"
                    style={{ color: colors.ink }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {debt > 0 ? (
                    <Text
                      className="ml-2 text-xs font-semibold"
                      style={{ color: colors.danger }}
                    >
                      долг {formatMoney(debt)}
                    </Text>
                  ) : null}
                </View>
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: colors.inkMuted }}
                  numberOfLines={1}
                >
                  {[c.phone, c.matched_vehicle_label]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Text>
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: colors.inkFaint }}
                >
                  Заказов: {c.orders_count ?? 0}
                  {c.last_visit_at
                    ? ` · последний визит ${formatDayMonth(c.last_visit_at)}`
                    : ""}
                </Text>
              </Pressable>
            );
          })}
          {hasMore ? (
            <Pressable
              onPress={() => void loadMore()}
              disabled={loadingMore}
              className="items-center rounded-2xl py-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.brand }}
                >
                  Показать ещё{page ? ` (${rows.length}/${page.total})` : ""}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      )}

      <Sheet
        visible={!!selected}
        title={selected?.name}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <View className="gap-3">
            {selected.phone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${selected.phone}`)}
                className="flex-row items-center gap-2 self-start rounded-full px-4 py-2"
                style={{ backgroundColor: colors.brand }}
              >
                <Ionicons name="call" size={16} color="#fff" />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: "#fff" }}
                >
                  {selected.phone}
                </Text>
              </Pressable>
            ) : null}
            <View className="flex-row flex-wrap gap-2">
              {[
                ["Заказов", String(selected.orders_count ?? 0)],
                ["Сумма заказов", formatMoney(num(selected.orders_total))],
                ["Оплачено", formatMoney(num(selected.paid_total))],
                ["Долг", formatMoney(num(selected.debt_amount))],
                ["Скидка", `${num(selected.discount_percent)}%`],
              ].map(([label, value]) => (
                <View
                  key={label}
                  className="min-w-[45%] flex-1 rounded-xl p-3"
                  style={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <Text className="text-xs" style={{ color: colors.inkMuted }}>
                    {label}
                  </Text>
                  <Text
                    className="mt-1 text-sm font-semibold"
                    style={{ color: colors.ink }}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              className="text-xs font-semibold uppercase"
              style={{ color: colors.inkMuted }}
            >
              Автомобили
            </Text>
            {vehicles === null ? (
              <ActivityIndicator color={colors.brand} />
            ) : vehicles.length === 0 ? (
              <Text className="text-sm" style={{ color: colors.inkMuted }}>
                Нет привязанных авто
              </Text>
            ) : (
              vehicles.map((v) => (
                <Text
                  key={v.id}
                  className="text-sm"
                  style={{ color: colors.ink }}
                >
                  {[v.make, v.model, v.plate].filter(Boolean).join(" ")}
                </Text>
              ))
            )}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
