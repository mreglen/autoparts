import { ActivityIndicator, Pressable, View } from "react-native";
import {
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchShopCart,
  removeShopCartItem,
  updateShopCartItemQty,
  type ShopCartItem,
} from "../api/partsShop";
import { describeError } from "../api/errors";
import { Button, Card, EmptyState, Screen, SkeletonRows, useToast } from "../components/ui";
import { useTheme } from "../theme/useTheme";
import { cartTotal, formatDeliveryText, formatMoney, truncateRubles } from "../utils/partsShop";
import { AppText as Text } from "../components/ui/AppText";

function CartRow({
  item,
  onQty,
  onRemove,
  busy,
}: {
  item: ShopCartItem;
  onQty: (delta: number) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const unit = truncateRubles(Number(item.price ?? 0));
  const sum = unit * item.quantity;
  const unavailable = item.available === false;

  return (
    <Card padded={false} className="mb-2 px-4 py-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-medium" style={{ color: colors.ink }} numberOfLines={2}>
            {item.name || [item.brand, item.partnumber].filter(Boolean).join(" ") || "Запчасть"}
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: colors.inkMuted }} numberOfLines={1}>
            {[item.brand, item.partnumber].filter(Boolean).join(" · ")}
          </Text>
          <Text className="mt-1 text-xs" style={{ color: colors.inkFaint }}>
            {[
              formatDeliveryText(item.delivery_start, item.delivery_end),
              unavailable ? "Нет в наличии" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <Pressable onPress={onRemove} disabled={busy} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-sm" style={{ color: colors.inkMuted }}>
          {formatMoney(unit)} × {item.quantity} ={" "}
          <Text className="font-semibold" style={{ color: colors.ink }}>
            {formatMoney(sum)}
          </Text>
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => onQty(-1)}
            disabled={busy}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.line }}
          >
            <Ionicons name="remove" size={16} color={colors.ink} />
          </Pressable>
          <Text className="w-6 text-center text-base font-semibold" style={{ color: colors.ink }}>
            {item.quantity}
          </Text>
          <Pressable
            onPress={() => onQty(1)}
            disabled={busy || (item.max_quantity != null && item.quantity >= item.max_quantity)}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                item.max_quantity != null && item.quantity >= item.max_quantity
                  ? colors.line
                  : colors.brand,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add" size={16} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

export function ClientCartScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["shop-cart"],
    queryFn: fetchShopCart,
    staleTime: 15_000,
  });

  const basket = (data?.new_parts_baskets ?? []).find((b) => b.is_default);
  const items = basket?.items ?? data?.new_parts_items ?? [];

  const qtyMutation = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      updateShopCartItemQty(id, qty),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shop-cart"] }),
    onError: (e) => show(describeError(e), "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeShopCartItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shop-cart"] }),
    onError: (e) => show(describeError(e), "error"),
  });

  const total = cartTotal(items);
  const busy = qtyMutation.isPending || removeMutation.isPending;

  const changeQty = (item: ShopCartItem, delta: number) => {
    const next = item.quantity + delta;
    if (next <= 0) {
      removeMutation.mutate(item.id);
      return;
    }
    const cap = item.max_quantity ?? Number.POSITIVE_INFINITY;
    qtyMutation.mutate({ id: item.id, qty: Math.min(next, cap) });
  };

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <SkeletonRows count={3} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
        <EmptyState
          icon="cart-outline"
          title="Корзина пуста"
          message="Найдите запчасть по артикулу — привезём под заказ."
          actionLabel="Перейти к поиску"
          onAction={() => navigation.navigate("ClientSearch")}
        />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
      {items.map((item) => (
        <CartRow
          key={item.id}
          item={item}
          busy={busy}
          onQty={(d) => changeQty(item, d)}
          onRemove={() => removeMutation.mutate(item.id)}
        />
      ))}

      <Card className="mt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-base" style={{ color: colors.inkMuted }}>
            Итого
          </Text>
          <Text className="text-xl font-bold" style={{ color: colors.brand }}>
            {formatMoney(total)}
          </Text>
        </View>
        <Text className="mt-2 text-xs" style={{ color: colors.inkFaint }}>
          Самовывоз · оплата после подтверждения наличия
        </Text>
        <Button
          title="Оформить заказ"
          className="mt-4"
          onPress={() => navigation.navigate("ClientCheckout")}
        />
      </Card>
    </Screen>
  );
}
