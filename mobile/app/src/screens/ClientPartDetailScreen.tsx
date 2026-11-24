import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addShopPartToCart,
  DEFAULT_BUYER_MARKUP_PERCENT,
  fetchShopCart,
  fetchShopSiteConfig,
  removeShopCartItem,
  updateShopCartItemQty,
  type AddShopCartItemPayload,
  type ShopCartItem,
} from "../api/partsShop";
import { describeError } from "../api/errors";
import { Button, Card, Screen, useToast } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import {
  applyMarkup,
  collectAnalogs,
  formatDeliveryText,
  formatMoney,
  inStockStocks,
  partArticle,
  partBrand,
  partTitle,
  type ShopStockData,
} from "../utils/partsShop";
import { AppText as Text } from "../components/ui/AppText";

type DetailRoute = RouteProp<RootStackParamList, "ClientPartDetail">;

function useBuyerMarkup(): number {
  const { data } = useQuery({
    queryKey: ["shop-markup"],
    queryFn: fetchShopSiteConfig,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const value = Number(data?.new_parts_markup_percent);
  return Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_BUYER_MARKUP_PERCENT;
}

function cartQtyFor(cartItems: ShopCartItem[], stockId: string): ShopCartItem | null {
  return (
    cartItems.find(
      (i) => i.stock_id && String(i.stock_id) === stockId && i.available !== false,
    ) ?? null
  );
}

export function ClientPartDetailScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const route = useRoute<DetailRoute>();
  const { part } = route.params;
  const queryClient = useQueryClient();
  const markup = useBuyerMarkup();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: cart } = useQuery({
    queryKey: ["shop-cart"],
    queryFn: fetchShopCart,
    staleTime: 15_000,
  });
  const basket = (cart?.new_parts_baskets ?? []).find((b) => b.is_default);
  const cartItems = basket?.items ?? cart?.new_parts_items ?? [];

  const stocks = useMemo(() => {
    const mapped = inStockStocks(part);
    return mapped
      .map((s) => ({ ...s, buyer_price: applyMarkup(s.price, markup) }))
      .sort((a, b) => {
        if (a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1;
        if (a.buyer_price !== b.buyer_price) return a.buyer_price - b.buyer_price;
        return a.available_count - b.available_count;
      });
  }, [part, markup]);

  const analogs = useMemo(() => collectAnalogs([part]), [part]);

  const refreshCart = () =>
    queryClient.invalidateQueries({ queryKey: ["shop-cart"] });

  const buildPayload = (stock: ShopStockData): AddShopCartItemPayload => ({
    brand: partBrand(part) || "—",
    partnumber: partArticle(part) || "—",
    name: partTitle(part) || partArticle(part) || "Запчасть",
    quantity: 1,
    price: applyMarkup(stock.price, markup),
    supplier_unit_price: stock.price,
    stock_id: stock.stock_id,
    max_quantity: stock.available_count,
    guid: part.guid,
    delivery_start: stock.delivery_start ?? undefined,
    delivery_end: stock.delivery_end ?? undefined,
  });

  const changeQty = async (stock: ShopStockData, delta: number) => {
    const existing = cartQtyFor(cartItems, stock.stock_id);
    const key = stock.stock_id;
    setBusy(key);
    try {
      if (!existing) {
        if (delta <= 0) return;
        await addShopPartToCart(buildPayload(stock));
      } else {
        const next = existing.quantity + delta;
        if (next <= 0) {
          await removeShopCartItem(existing.id);
        } else {
          await updateShopCartItemQty(existing.id, Math.min(next, stock.available_count));
        }
      }
      await refreshCart();
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const minBuyerPrice = stocks.length
    ? Math.min(...stocks.map((s) => s.buyer_price))
    : 0;

  return (
    <Screen>
      <Card className="mb-4">
        <Text className="text-sm" style={{ color: colors.inkMuted }}>
          {[partBrand(part), partArticle(part)].filter(Boolean).join(" · ")}
        </Text>
        <Text className="mt-1 text-lg font-semibold" style={{ color: colors.ink }}>
          {partTitle(part) || partArticle(part) || "Запчасть"}
        </Text>
        {minBuyerPrice > 0 ? (
          <Text className="mt-2 text-xl font-bold" style={{ color: colors.brand }}>
            {formatMoney(minBuyerPrice)}
            <Text className="text-sm font-normal" style={{ color: colors.inkMuted }}>
              {" "}
              · от поставщика, с доставкой
            </Text>
          </Text>
        ) : null}
      </Card>

      {stocks.length === 0 ? (
        <Text className="py-8 text-center text-sm" style={{ color: colors.inkMuted }}>
          Сейчас нет предложений с доставкой. Попробуйте позже.
        </Text>
      ) : (
        stocks.map((stock) => {
          const existing = cartQtyFor(cartItems, stock.stock_id);
          const qty = existing?.quantity ?? 0;
          const isBusy = busy === stock.stock_id;
          return (
            <Card key={stock.stock_id} padded={false} className="mb-2 px-4 py-3">
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1">
                  <Text className="text-base font-semibold" style={{ color: colors.ink }}>
                    {formatMoney(stock.buyer_price)}
                  </Text>
                  <Text className="mt-0.5 text-xs" style={{ color: colors.inkMuted }}>
                    {[
                      `Доступно: ${stock.available_count}`,
                      formatDeliveryText(stock.delivery_start, stock.delivery_end),
                    ].join(" · ")}
                  </Text>
                </View>
                {qty > 0 ? (
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      onPress={() => void changeQty(stock, -1)}
                      disabled={isBusy}
                      className="h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: colors.line }}
                    >
                      <Ionicons name="remove" size={16} color={colors.ink} />
                    </Pressable>
                    <Text className="w-6 text-center text-base font-semibold" style={{ color: colors.ink }}>
                      {qty}
                    </Text>
                    <Pressable
                      onPress={() => void changeQty(stock, 1)}
                      disabled={isBusy || qty >= stock.available_count}
                      className="h-8 w-8 items-center justify-center rounded-full"
                      style={{
                        backgroundColor:
                          qty >= stock.available_count ? colors.line : colors.brand,
                      }}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="add" size={16} color="#fff" />
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <Button
                    title="В корзину"
                    compact
                    loading={isBusy}
                    onPress={() => void changeQty(stock, 1)}
                  />
                )}
              </View>
            </Card>
          );
        })
      )}

      {analogs.length > 0 ? (
        <>
          <Text className="mb-2 mt-5 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
            Аналоги
          </Text>
          {analogs.slice(0, 8).map((a) => {
            const aMin = inStockStocks(a)[0];
            return (
              <Card
                key={String(a.guid || `${a.brand}|${a.partnumber}`)}
                padded={false}
                className="mb-1 flex-row items-center px-4 py-3"
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-sm" style={{ color: colors.inkMuted }} numberOfLines={1}>
                    {[partBrand(a), partArticle(a)].filter(Boolean).join(" · ")}
                  </Text>
                  <Text className="text-base" style={{ color: colors.ink }} numberOfLines={1}>
                    {partTitle(a) || partArticle(a) || "Запчасть"}
                  </Text>
                </View>
                {aMin ? (
                  <Text className="ml-3 text-sm font-medium" style={{ color: colors.brand }}>
                    {formatMoney(applyMarkup(aMin.price, markup))}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
