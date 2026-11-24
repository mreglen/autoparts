import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  createExpense,
  createReceipt,
  createReturn,
  fetchItemMovements,
  fetchItemReservations,
  fetchPurchaseLots,
  fetchReturns,
  fetchWarehouseItems,
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  UNIT_LABELS,
  type ItemMovements,
  type ItemReservation,
  type PurchaseLot,
  type WarehouseItem,
  type WarehouseReturn,
} from "../api/warehouse";
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
import { formatDayMonth, formatMoney } from "../utils/format";

const PAGE = 50;

function unitLabel(unit?: string): string {
  return UNIT_LABELS[unit ?? "pcs"] ?? unit ?? "шт";
}

function qtyText(qty: number, unit?: string): string {
  return `${qty} ${unitLabel(unit)}`;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
}) {
  const { colors } = useTheme();
  return (
    <View className="mb-3">
      <Text
        className="mb-1.5 text-xs font-medium"
        style={{ color: colors.inkMuted }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        keyboardType={keyboardType}
        className="rounded-xl px-4 py-3 text-base"
        style={{ backgroundColor: colors.surfaceSubtle, color: colors.ink }}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3 py-1.5"
      style={{ backgroundColor: active ? colors.brand : colors.surfaceSubtle }}
    >
      <Text
        className="text-xs font-medium"
        style={{ color: active ? "#fff" : colors.inkSoft }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function WarehouseScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [tab, setTab] = useState<"stock" | "returns">("stock");
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<{ fetchedAt: number } | null>(null);
  const offsetRef = useRef(0);

  const [detail, setDetail] = useState<WarehouseItem | null>(null);
  const [movements, setMovements] = useState<ItemMovements | null>(null);
  const [reservations, setReservations] = useState<ItemReservation[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [receiptSheet, setReceiptSheet] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    brand: "",
    article: "",
    name: "",
    qty: "1",
    unit: "pcs" as "pcs" | "l" | "kg",
    price: "",
  });
  const [saving, setSaving] = useState(false);

  const [expenseSheet, setExpenseSheet] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ qty: "1", reason: "" });

  const [lots, setLots] = useState<PurchaseLot[]>([]);
  const [returns, setReturns] = useState<WarehouseReturn[]>([]);
  const [returnSheet, setReturnSheet] = useState<PurchaseLot | null>(null);
  const [returnForm, setReturnForm] = useState({
    qty: "1",
    reason: "defect",
    comment: "",
  });

  const loadItems = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoading(true);
        offsetRef.current = 0;
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await fetchWarehouseItems({
          q: query.trim() || undefined,
          availableOnly,
          limit: PAGE,
          offset: reset ? 0 : offsetRef.current,
        });
        setItems((prev) =>
          reset ? result.data.items : [...prev, ...result.data.items],
        );
        setTotal(result.data.total);
        setHasMore(result.data.has_more);
        offsetRef.current = reset
          ? result.data.items.length
          : offsetRef.current + result.data.items.length;
        setStale(result.stale ? { fetchedAt: result.fetchedAt } : null);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [query, availableOnly, show],
  );

  useEffect(() => {
    const t = setTimeout(() => void loadItems(true), 350);
    return () => clearTimeout(t);
  }, [loadItems]);

  const loadReturnsData = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([
        fetchReturns().catch(() => null),
        fetchPurchaseLots().catch(() => null),
      ]);
      setReturns(r?.data ?? []);
      setLots(l?.data ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (tab !== "returns") return;
    const t = setTimeout(() => void loadReturnsData(), 0);
    return () => clearTimeout(t);
  }, [tab, loadReturnsData]);

  const openItem = async (item: WarehouseItem) => {
    setDetail(item);
    setMovements(null);
    setReservations([]);
    setDetailLoading(true);
    try {
      const [m, r] = await Promise.all([
        fetchItemMovements(item.id).catch(() => null),
        fetchItemReservations(item.id).catch(() => null),
      ]);
      setMovements(m?.data ?? null);
      setReservations(r?.data ?? []);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReceipt = async () => {
    const name = receiptForm.name.trim();
    if (!name) {
      show("Укажите название детали", "error");
      return;
    }
    setSaving(true);
    try {
      await createReceipt({
        brand: receiptForm.brand.trim() || undefined,
        article: receiptForm.article.trim() || undefined,
        name,
        quantity: Math.max(1, Math.round(Number(receiptForm.qty) || 1)),
        unit: receiptForm.unit,
        unit_price: Math.max(0, Number(receiptForm.price) || 0),
      });
      show("Поступление создано", "success");
      setReceiptSheet(false);
      setReceiptForm({
        brand: "",
        article: "",
        name: "",
        qty: "1",
        unit: "pcs",
        price: "",
      });
      void loadItems(true);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const submitExpense = async () => {
    if (!detail) return;
    const qty = Math.max(1, Math.round(Number(expenseForm.qty) || 1));
    setSaving(true);
    try {
      await createExpense({
        item_id: detail.id,
        quantity: qty,
        reason: expenseForm.reason.trim() || undefined,
      });
      show("Расход списан", "success");
      setExpenseSheet(false);
      setExpenseForm({ qty: "1", reason: "" });
      setDetail(null);
      void loadItems(true);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const submitReturn = async () => {
    if (!returnSheet) return;
    setSaving(true);
    try {
      await createReturn({
        receipt_id: returnSheet.receipt_id,
        quantity: Math.max(
          1,
          Math.min(
            Math.round(Number(returnForm.qty) || 1),
            returnSheet.max_returnable_qty,
          ),
        ),
        reason: returnForm.reason,
        comment: returnForm.comment.trim() || undefined,
      });
      show("Возврат оформлен", "success");
      setReturnSheet(null);
      setReturnForm({ qty: "1", reason: "defect", comment: "" });
      void loadReturnsData();
      void loadItems(true);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const returnableLots = lots.filter((l) => l.max_returnable_qty > 0);

  return (
    <Screen
      onRefresh={() => {
        setRefreshing(true);
        if (tab === "stock") void loadItems(true);
        else void loadReturnsData().finally(() => setRefreshing(false));
      }}
      refreshing={refreshing}
    >
      {/* Переключатель вкладок */}
      <View className="mb-3 flex-row gap-2">
        <Chip
          label="Остатки"
          active={tab === "stock"}
          onPress={() => setTab("stock")}
        />
        <Chip
          label="Возвраты"
          active={tab === "returns"}
          onPress={() => setTab("returns")}
        />
      </View>

      {tab === "stock" ? (
        <>
          <View
            className="mb-3 flex-row items-center gap-2 rounded-xl px-3"
            style={{ backgroundColor: colors.surfaceSubtle, height: 42 }}
          >
            <Ionicons name="search" size={16} color={colors.inkFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Название, артикул, бренд"
              placeholderTextColor={colors.inkFaint}
              className="flex-1 text-sm"
              style={{ color: colors.ink }}
            />
          </View>
          <View className="mb-3 flex-row gap-2">
            <Chip
              label="Только в наличии"
              active={availableOnly}
              onPress={() => setAvailableOnly((v) => !v)}
            />
            <Chip label={`Всего: ${total}`} active={false} onPress={() => {}} />
          </View>
          {stale ? <StaleDataBadge fetchedAt={stale.fetchedAt} /> : null}

          {loading ? (
            <SkeletonRows count={8} />
          ) : items.length === 0 ? (
            <Text
              className="py-8 text-center text-sm"
              style={{ color: colors.inkMuted }}
            >
              {query ? "Ничего не найдено" : "Склад пуст"}
            </Text>
          ) : (
            <>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => void openItem(item)}
                  className="mb-2 rounded-xl p-3"
                  style={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-sm font-medium"
                        style={{ color: colors.ink }}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: colors.inkMuted }}
                        numberOfLines={1}
                      >
                        {[item.brand, item.article]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="text-sm font-semibold"
                        style={{
                          color:
                            item.available_qty > 0 ? colors.ink : colors.danger,
                        }}
                      >
                        {qtyText(item.available_qty, item.unit)}
                      </Text>
                      <Text
                        className="text-[10px]"
                        style={{ color: colors.inkMuted }}
                      >
                        из {qtyText(item.quantity, item.unit)}
                        {item.reserved_qty > 0
                          ? ` · резерв ${item.reserved_qty}`
                          : ""}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              {hasMore ? (
                <Pressable
                  onPress={() => void loadItems(false)}
                  disabled={loadingMore}
                  className="mt-1 items-center rounded-xl py-3"
                  style={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.brand }}
                  >
                    {loadingMore ? "Загрузка…" : "Показать ещё"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}

          <Pressable
            onPress={() => setReceiptSheet(true)}
            className="mt-4 flex-row items-center justify-center gap-1.5 rounded-xl py-3.5"
            style={{ backgroundColor: colors.brand }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-sm font-semibold text-white">
              Приход на склад
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text
            className="mb-2 text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Оформленные возвраты
          </Text>
          {returns.length === 0 ? (
            <Text className="py-4 text-sm" style={{ color: colors.inkMuted }}>
              Возвратов пока нет
            </Text>
          ) : (
            returns.slice(0, 50).map((r) => (
              <View
                key={r.id}
                className="mb-2 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    className="flex-1 text-sm font-medium"
                    style={{ color: colors.ink }}
                    numberOfLines={1}
                  >
                    {r.name}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.inkMuted }}>
                    {RETURN_STATUS_LABELS[r.status_code] ?? r.status_code}
                  </Text>
                </View>
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: colors.inkMuted }}
                >
                  {[r.brand, r.article].filter(Boolean).join(" · ") || "—"} ·{" "}
                  {formatDayMonth(r.created_at)} ·{" "}
                  {RETURN_REASON_LABELS[r.reason] ?? r.reason}
                </Text>
              </View>
            ))
          )}

          <Text
            className="mb-2 mt-4 text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Доступно к возврату ({returnableLots.length})
          </Text>
          {returnableLots.length === 0 ? (
            <Text className="py-4 text-sm" style={{ color: colors.inkMuted }}>
              Нет позиций, доступных для возврата
            </Text>
          ) : (
            returnableLots.slice(0, 50).map((lot) => (
              <Pressable
                key={lot.receipt_id}
                onPress={() => {
                  setReturnSheet(lot);
                  setReturnForm({
                    qty: String(lot.max_returnable_qty),
                    reason: "defect",
                    comment: "",
                  });
                }}
                className="mb-2 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    className="flex-1 text-sm font-medium"
                    style={{ color: colors.ink }}
                    numberOfLines={1}
                  >
                    {lot.name}
                  </Text>
                  <Text
                    className="text-xs font-medium"
                    style={{ color: colors.brand }}
                  >
                    до {lot.max_returnable_qty} {unitLabel(lot.unit)}
                  </Text>
                </View>
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: colors.inkMuted }}
                >
                  {[lot.brand, lot.article].filter(Boolean).join(" · ") || "—"}{" "}
                  · {lot.supplier_name || "Поставщик"} ·{" "}
                  {formatDayMonth(lot.created_at)}
                </Text>
              </Pressable>
            ))
          )}
        </>
      )}

      {/* Шторка: карточка позиции */}
      <Sheet
        visible={detail != null}
        title={detail?.name ?? ""}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <ScrollView className="max-h-[70vh]">
            <Text className="mb-1 text-xs" style={{ color: colors.inkMuted }}>
              {[detail.brand, detail.article].filter(Boolean).join(" · ") ||
                "—"}
            </Text>
            <View className="mb-3 flex-row gap-4">
              <Text className="text-sm" style={{ color: colors.ink }}>
                Остаток:{" "}
                <Text className="font-semibold">
                  {qtyText(detail.available_qty, detail.unit)}
                </Text>
              </Text>
              <Text className="text-sm" style={{ color: colors.ink }}>
                Цена:{" "}
                <Text className="font-semibold">
                  {formatMoney(detail.unit_price)}
                </Text>
              </Text>
            </View>

            {detailLoading ? (
              <SkeletonRows count={3} />
            ) : (
              <>
                {reservations.length > 0 ? (
                  <>
                    <Text
                      className="mb-1 mt-2 text-xs font-semibold uppercase"
                      style={{ color: colors.inkMuted }}
                    >
                      Резервы
                    </Text>
                    {reservations.map((r) => (
                      <Pressable
                        key={r.repair_order_id}
                        onPress={() => {
                          setDetail(null);
                          navigation.navigate("OrderDetail", {
                            id: r.repair_order_id,
                          });
                        }}
                        className="mb-1.5 flex-row items-center justify-between rounded-lg p-2.5"
                        style={{ backgroundColor: colors.surfaceSubtle }}
                      >
                        <Text className="text-sm" style={{ color: colors.ink }}>
                          Заказ-наряд №
                          {r.repair_order_number ?? r.repair_order_id}
                        </Text>
                        <Text
                          className="text-xs"
                          style={{ color: colors.inkMuted }}
                        >
                          {qtyText(Number(r.qty), r.unit)}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}

                {movements?.events?.length ? (
                  <>
                    <Text
                      className="mb-1 mt-3 text-xs font-semibold uppercase"
                      style={{ color: colors.inkMuted }}
                    >
                      Движения
                    </Text>
                    {movements.events.slice(0, 30).map((ev, i) => (
                      <View
                        key={i}
                        className="mb-1.5 flex-row items-center justify-between rounded-lg p-2.5"
                        style={{ backgroundColor: colors.surfaceSubtle }}
                      >
                        <View className="min-w-0 flex-1">
                          <Text
                            className="text-sm"
                            style={{ color: colors.ink }}
                            numberOfLines={1}
                          >
                            {ev.title}
                          </Text>
                          <Text
                            className="text-[10px]"
                            style={{ color: colors.inkMuted }}
                          >
                            {formatDayMonth(ev.date)}
                            {ev.detail ? ` · ${ev.detail}` : ""}
                            {ev.repair_order_number
                              ? ` · ЗН №${ev.repair_order_number}`
                              : ""}
                          </Text>
                        </View>
                        <Text
                          className="ml-2 text-sm font-medium"
                          style={{
                            color:
                              ev.kind === "expense" || ev.kind === "return"
                                ? colors.danger
                                : colors.success,
                          }}
                        >
                          {ev.kind === "expense" || ev.kind === "return"
                            ? "−"
                            : "+"}
                          {ev.quantity} {unitLabel(ev.unit)}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text
                    className="py-3 text-sm"
                    style={{ color: colors.inkMuted }}
                  >
                    Движений пока нет
                  </Text>
                )}
              </>
            )}

            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() => {
                  setReceiptForm((p) => ({
                    ...p,
                    brand: detail.brand,
                    article: detail.article,
                    name: detail.name,
                  }));
                  setDetail(null);
                  setReceiptSheet(true);
                }}
                className="flex-1 items-center rounded-xl py-2.5"
                style={{ backgroundColor: colors.successSoft }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.success }}
                >
                  Приход
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setExpenseForm({ qty: "1", reason: "" });
                  setExpenseSheet(true);
                }}
                className="flex-1 items-center rounded-xl py-2.5"
                style={{ backgroundColor: colors.dangerSoft }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.danger }}
                >
                  Расход
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </Sheet>

      {/* Шторка: приход */}
      <Sheet
        visible={receiptSheet}
        title="Приход на склад"
        onClose={() => setReceiptSheet(false)}
      >
        <ScrollView className="max-h-[70vh]">
          <Field
            label="Бренд"
            value={receiptForm.brand}
            onChangeText={(v) => setReceiptForm((p) => ({ ...p, brand: v }))}
          />
          <Field
            label="Артикул"
            value={receiptForm.article}
            onChangeText={(v) => setReceiptForm((p) => ({ ...p, article: v }))}
          />
          <Field
            label="Название *"
            value={receiptForm.name}
            onChangeText={(v) => setReceiptForm((p) => ({ ...p, name: v }))}
          />
          <View className="mb-3 flex-row gap-2">
            <View className="flex-1">
              <Field
                label="Кол-во"
                value={receiptForm.qty}
                onChangeText={(v) => setReceiptForm((p) => ({ ...p, qty: v }))}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text
                className="mb-1.5 text-xs font-medium"
                style={{ color: colors.inkMuted }}
              >
                Ед.
              </Text>
              <View className="flex-row gap-1">
                {(["pcs", "l", "kg"] as const).map((u) => (
                  <View key={u} className="flex-1">
                    <Chip
                      label={unitLabel(u)}
                      active={receiptForm.unit === u}
                      onPress={() => setReceiptForm((p) => ({ ...p, unit: u }))}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
          <Field
            label="Цена за ед."
            value={receiptForm.price}
            onChangeText={(v) => setReceiptForm((p) => ({ ...p, price: v }))}
            keyboardType="numeric"
          />
          <Pressable
            onPress={() => void submitReceipt()}
            disabled={saving}
            className="items-center rounded-xl py-3.5"
            style={{ backgroundColor: colors.brand, opacity: saving ? 0.6 : 1 }}
          >
            <Text className="text-sm font-semibold text-white">
              {saving ? "Сохранение…" : "Оприходовать"}
            </Text>
          </Pressable>
        </ScrollView>
      </Sheet>

      {/* Шторка: расход */}
      <Sheet
        visible={expenseSheet}
        title={`Расход: ${detail?.name ?? ""}`}
        onClose={() => setExpenseSheet(false)}
      >
        <Field
          label="Количество"
          value={expenseForm.qty}
          onChangeText={(v) => setExpenseForm((p) => ({ ...p, qty: v }))}
          keyboardType="numeric"
        />
        <Field
          label="Причина / комментарий"
          value={expenseForm.reason}
          onChangeText={(v) => setExpenseForm((p) => ({ ...p, reason: v }))}
          placeholder="Списание, брак, использование…"
        />
        <Pressable
          onPress={() => void submitExpense()}
          disabled={saving}
          className="items-center rounded-xl py-3.5"
          style={{ backgroundColor: colors.danger, opacity: saving ? 0.6 : 1 }}
        >
          <Text className="text-sm font-semibold text-white">
            {saving ? "Списание…" : "Списать со склада"}
          </Text>
        </Pressable>
      </Sheet>

      {/* Шторка: возврат */}
      <Sheet
        visible={returnSheet != null}
        title={`Возврат: ${returnSheet?.name ?? ""}`}
        onClose={() => setReturnSheet(null)}
      >
        {returnSheet ? (
          <ScrollView className="max-h-[70vh]">
            <Text className="mb-3 text-xs" style={{ color: colors.inkMuted }}>
              Поставщик: {returnSheet.supplier_name || "—"} · можно вернуть до{" "}
              {returnSheet.max_returnable_qty} {unitLabel(returnSheet.unit)}
            </Text>
            <Field
              label="Количество"
              value={returnForm.qty}
              onChangeText={(v) => setReturnForm((p) => ({ ...p, qty: v }))}
              keyboardType="numeric"
            />
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{ color: colors.inkMuted }}
            >
              Причина
            </Text>
            <View className="mb-3 flex-row flex-wrap gap-1.5">
              {Object.entries(RETURN_REASON_LABELS).map(([code, label]) => (
                <Chip
                  key={code}
                  label={label}
                  active={returnForm.reason === code}
                  onPress={() => setReturnForm((p) => ({ ...p, reason: code }))}
                />
              ))}
            </View>
            <Field
              label="Комментарий"
              value={returnForm.comment}
              onChangeText={(v) => setReturnForm((p) => ({ ...p, comment: v }))}
            />
            <Pressable
              onPress={() => void submitReturn()}
              disabled={saving}
              className="items-center rounded-xl py-3.5"
              style={{
                backgroundColor: colors.brand,
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text className="text-sm font-semibold text-white">
                {saving ? "Оформление…" : "Оформить возврат"}
              </Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </Sheet>
    </Screen>
  );
}
