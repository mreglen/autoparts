import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import {
  DEFAULT_BUYER_MARKUP_PERCENT,
  fetchShopSiteConfig,
  searchShopParts,
  type ShopPart,
} from "../api/partsShop";
import { describeError } from "../api/errors";
import { Button, Card, EmptyState, Screen } from "../components/ui";
import { inputChrome } from "../components/ui/chrome";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import {
  applyMarkup,
  collectAnalogs,
  dedupeParts,
  formatDeliveryText,
  formatMoney,
  getMinPrice,
  getStockCount,
  normalizeArticle,
  partArticle,
  partBrand,
  partDedupeKey,
  partTitle,
  splitOriginalAndAnalogs,
} from "../utils/partsShop";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

const QUICK_CHIPS = [
  "тормозные колодки",
  "масляный фильтр",
  "ремень ГРМ",
  "свечи зажигания",
  "фильтр салона",
  "KYB",
];

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

function partCardKey(part: ShopPart): string {
  return partDedupeKey(part) || `${part.brand}|${part.partnumber || part.article}`;
}

function PartCard({
  part,
  markup,
  onPress,
}: {
  part: ShopPart;
  markup: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const minPrice = getMinPrice(part);
  const price = applyMarkup(minPrice, markup);
  const stocks = Array.isArray(part.stocks?.stock)
    ? part.stocks.stock
    : part.stocks?.stock
      ? [part.stocks.stock]
      : [];
  const deliverable = stocks.filter(
    (s) => s && (s.deliveryStart ?? s.delivery_start) && (s.deliveryEnd ?? s.delivery_end),
  );
  const earliestStock = deliverable
    .slice()
    .sort(
      (a, b) =>
        new Date(a.deliveryStart ?? a.delivery_start ?? 0).getTime() -
        new Date(b.deliveryStart ?? b.delivery_start ?? 0).getTime(),
    )[0];
  const deliveryText = earliestStock
    ? formatDeliveryText(
        earliestStock.deliveryStart ?? earliestStock.delivery_start,
        earliestStock.deliveryEnd ?? earliestStock.delivery_end,
      )
    : null;
  const count = getStockCount(part);

  return (
    <Pressable onPress={onPress} className="mb-2">
      <Card padded={false} className="px-4 py-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm" style={{ color: colors.inkMuted }} numberOfLines={1}>
            {[partBrand(part), partArticle(part)].filter(Boolean).join(" · ")}
          </Text>
          <Text className="mt-0.5 text-base font-medium" style={{ color: colors.ink }} numberOfLines={2}>
            {partTitle(part) || partArticle(part) || "Запчасть"}
          </Text>
          <Text className="mt-1 text-xs" style={{ color: colors.inkFaint }}>
            {[
              count > 0 ? `В наличии: ${count}` : null,
              deliveryText ? `Поставка: ${deliveryText}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-semibold" style={{ color: colors.brand }}>
            {price > 0 ? formatMoney(price) : "—"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
        </View>
      </View>
      </Card>
    </Pressable>
  );
}

export function ClientSearchScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const markup = useBuyerMarkup();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShopPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle = inputChrome(colors);

  const { originals, analogs } = useMemo(() => {
    const deduped = dedupeParts(results);
    return splitOriginalAndAnalogs(deduped, normalizeArticle(query));
  }, [results, query]);

  const allAnalogs = useMemo(
    () => collectAnalogs(dedupeParts(results)),
    [results],
  );

  const doSearch = async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await searchShopParts(q);
      const raw = res?.PartsList?.Part;
      const parts = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
      setResults(parts);
    } catch (e) {
      setResults([]);
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  const openPart = (part: ShopPart) => {
    navigation.navigate("ClientPartDetail", { part });
  };

  return (
    <Screen scroll={false} contentContainerStyle={{ flex: 1 }}>
      <View className="flex-1">
        <View
          className="mb-3 flex-row items-center gap-2 rounded-xl px-4"
          style={inputStyle}
        >
          <Ionicons name="search" size={18} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Артикул или название запчасти"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void doSearch()}
            className="flex-1 py-3 text-base"
            style={{ color: colors.ink }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.inkFaint} />
            </Pressable>
          ) : null}
        </View>

        {!searched && !loading ? (
          <View className="flex-1">
            <Text className="mb-3 text-sm" style={{ color: colors.inkMuted }}>
              Например:
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {QUICK_CHIPS.map((chip) => (
                <Pressable
                  key={chip}
                  onPress={() => {
                    setQuery(chip);
                    void doSearch(chip);
                  }}
                  className="rounded-full px-3.5 py-1.5"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.lineStrong,
                  }}
                >
                  <Text className="text-sm" style={{ color: colors.ink }}>
                    {chip}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.brand} />
            <Text className="mt-3 text-sm" style={{ color: colors.inkMuted }}>
              Ищем запчасти…
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="flex-1 items-center justify-center px-6">
            <EmptyState
              icon="cloud-offline-outline"
              title="Нет соединения"
              message={error}
              actionLabel="Повторить"
              onAction={() => void doSearch()}
            />
          </View>
        ) : null}

        {searched && !loading && !error ? (
          originals.length + analogs.length === 0 && allAnalogs.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <EmptyState
                icon="search-outline"
                title="Ничего не найдено"
                message="Попробуйте другой артикул или название детали."
              />
            </View>
          ) : (
            <View className="flex-1">
              <View className="flex-1">
                {originals.map((part) => (
                  <PartCard
                    key={partCardKey(part)}
                    part={part}
                    markup={markup}
                    onPress={() => openPart(part)}
                  />
                ))}
                {analogs.length > 0 ? (
                  <Text className="mb-2 mt-3 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
                    Аналоги
                  </Text>
                ) : null}
                {analogs.map((part) => (
                  <PartCard
                    key={partCardKey(part)}
                    part={part}
                    markup={markup}
                    onPress={() => openPart(part)}
                  />
                ))}
                {originals.length === 0 && analogs.length === 0 && allAnalogs.length > 0 ? (
                  <>
                    <Text className="mb-2 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
                      Аналоги
                    </Text>
                    {allAnalogs.map((part) => (
                      <PartCard
                        key={partCardKey(part)}
                        part={part}
                        markup={markup}
                        onPress={() => openPart(part)}
                      />
                    ))}
                  </>
                ) : null}
              </View>
            </View>
          )
        ) : null}

        {searched && !loading && !error && (originals.length + analogs.length > 0 || allAnalogs.length > 0) ? (
          <Button
            title="Найти"
            icon="search"
            className="mt-2"
            onPress={() => void doSearch()}
          />
        ) : null}
      </View>
    </Screen>
  );
}
