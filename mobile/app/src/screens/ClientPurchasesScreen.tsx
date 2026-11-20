import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";

import {
  fetchPurchaseNewOrders,
  fetchPurchaseUsedOrders,
  type PurchaseNewOrder,
  type PurchaseUsedOrder,
} from "../api/partsShop";
import { describeError } from "../api/errors";
import { Screen, SkeletonRows } from "../components/ui";
import { useTheme } from "../theme/useTheme";
import {
  formatGarageOrderDate,
  garageDeliveryInfo,
  garageStatusLabel,
  isReadyForPickup,
  newOrderBuyerHint,
  usedOrderBuyerHint,
  type PurchaseOrderLike,
} from "../utils/partsShop";
import { formatMoney } from "../utils/format";

type Kind = "new" | "used";

interface UnifiedOrder extends PurchaseOrderLike {
  kind: Kind;
}

function statusColor(code: string): string {
  if (code === "new_received" || code === "delivered" || code === "closed") return "#059669";
  if (code === "rejected" || code === "canceled") return "#dc2626";
  if (code === "ready_for_pickup" || code === "new_ready_for_pickup") return "#0d9488";
  return "#d97706";
}

function OrderCard({ order }: { order: UnifiedOrder }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isNew = order.kind === "new";
  const statusCode = order.status_code || (isNew ? "new_waiting_confirmation" : "pending");
  const label = garageStatusLabel(statusCode);
  const hint = isNew ? newOrderBuyerHint(statusCode) : usedOrderBuyerHint(statusCode);
  const ready = isReadyForPickup(order);

  return (
    <View
      className="mb-3 rounded-xl px-4 py-3"
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              №{order.id} · {formatGarageOrderDate(order.created_at)}
            </Text>
            <Text className="mt-0.5 text-base font-medium" style={{ color: colors.ink }} numberOfLines={1}>
              {order.items?.length
                ? order.items
                    .slice(0, 2)
                    .map((i) => i.name)
                    .join(", ") + (order.items.length > 2 ? ` и ещё ${order.items.length - 2}` : "")
                : "Заказ"}
            </Text>
            <Text className="mt-1 text-xs" style={{ color: colors.inkFaint }} numberOfLines={2}>
              {garageDeliveryInfo(order)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-base font-semibold" style={{ color: colors.brand }}>
              {formatMoney(order.total_amount)}
            </Text>
            <Text
              className="mt-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ color: statusColor(statusCode), backgroundColor: `${statusColor(statusCode)}18` }}
            >
              {label}
            </Text>
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs" style={{ color: colors.inkFaint }}>
            {order.is_paid ? "Оплачено" : "Не оплачено"}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.inkFaint}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View className="mt-3 border-t pt-3" style={{ borderColor: colors.line }}>
          {(order.items ?? []).map((item) => (
            <View key={item.id} className="flex-row items-center justify-between py-1">
              <Text className="min-w-0 flex-1 text-sm" style={{ color: colors.ink }} numberOfLines={2}>
                {item.name}
                <Text style={{ color: colors.inkFaint }}>
                  {" "}
                  × {item.quantity}
                </Text>
              </Text>
              <Text className="ml-3 text-sm" style={{ color: colors.inkMuted }}>
                {formatMoney(item.price * item.quantity)}
              </Text>
            </View>
          ))}
          {hint ? (
            <Text className="mt-2 text-xs" style={{ color: colors.inkMuted }}>
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}

      {ready && order.pickup_qr_payload ? (
        <View className="mt-3 items-center rounded-xl bg-white p-4">
          <Text className="mb-2 text-sm font-medium" style={{ color: colors.ink }}>
            Код получения: {order.pickup_code || "—"}
          </Text>
          <QRCode value={order.pickup_qr_payload} size={180} />
          <Text className="mt-2 text-xs" style={{ color: colors.inkFaint }}>
            Покажите код продавцу при получении
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function ClientPurchasesScreen() {
  const { colors } = useTheme();
  const [kind, setKind] = useState<Kind>("new");

  const newQuery = useQuery({
    queryKey: ["shop-purchases-new"],
    queryFn: fetchPurchaseNewOrders,
  });
  const usedQuery = useQuery({
    queryKey: ["shop-purchases-used"],
    queryFn: async () => {
      const rows = await fetchPurchaseUsedOrders();
      return Array.isArray(rows) ? rows : [];
    },
  });

  const active = kind === "new" ? newQuery : usedQuery;

  const orders = useMemo<UnifiedOrder[]>(() => {
    if (kind === "new") {
      return ((newQuery.data ?? []) as PurchaseNewOrder[]).map((o) => ({
        ...o,
        kind: "new" as const,
      }));
    }
    return ((usedQuery.data ?? []) as PurchaseUsedOrder[]).map((o) => ({
      ...o,
      kind: "used" as const,
    }));
  }, [kind, newQuery.data, usedQuery.data]);

  const refresh = useCallback(() => {
    void newQuery.refetch();
    void usedQuery.refetch();
  }, [newQuery, usedQuery]);

  if (active.isLoading && !active.data) {
    return (
      <Screen scroll={false}>
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  const error = active.error ? describeError(active.error) : null;

  return (
    <Screen onRefresh={refresh} refreshing={active.isRefetching}>
      <View className="mb-4 flex-row gap-2">
        {(
          [
            ["new", "Новые запчасти"],
            ["used", "Б/у запчасти"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            className="flex-1 items-center rounded-xl py-2.5"
            style={{
              backgroundColor: kind === k ? colors.brand : colors.surfaceSubtle,
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: kind === k ? "#fff" : colors.ink }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View className="items-center py-8">
          <Text className="text-sm" style={{ color: colors.danger }}>
            {error}
          </Text>
          <Pressable onPress={() => void active.refetch()} className="mt-3 rounded-xl px-4 py-2" style={{ backgroundColor: colors.brand }}>
            <Text className="text-sm font-semibold text-white">Повторить</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View className="items-center pt-16">
          <Ionicons name="receipt-outline" size={44} color={colors.inkFaint} />
          <Text className="mt-3 text-base font-medium" style={{ color: colors.ink }}>
            Заказов пока нет
          </Text>
          <Text className="mt-1 text-center text-sm" style={{ color: colors.inkMuted }}>
            {kind === "new"
              ? "Найдите запчасть в поиске и оформите заказ."
              : "Заказы б/у запчастей появятся здесь после покупки."}
          </Text>
        </View>
      ) : (
        orders.map((order) => <OrderCard key={`${order.kind}-${order.id}`} order={order} />)
      )}
    </Screen>
  );
}
