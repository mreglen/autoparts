import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  deleteFinanceReceipt,
  fetchClientsWithDebt,
  fetchFinanceExpenses,
  fetchFinanceReceipts,
  PAYMENT_METHOD_LABELS,
  type ClientDebtRow,
  type FinanceExpense,
  type FinanceReceipt,
  type FinanceReceiptsResponse,
} from "../api/finance";
import { canAccessSection } from "../auth/access";
import { currentPermissionCodes } from "../auth/permissions";
import { useSession } from "../auth/session";
import { describeError } from "../api/errors";
import {
  ConfirmDialog,
  DateField,
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
  formatMoney,
  formatTime,
  toIsoDate,
} from "../utils/format";

type Tab = "receipts" | "expenses" | "debts";

function monthStart(): string {
  const d = new Date();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
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

export function FinanceScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const { user } = useSession();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const codes = currentPermissionCodes();
  const canCancelReceipt =
    canAccessSection(user, codes, "finance") ||
    canAccessSection(user, codes, "orders");

  const [tab, setTab] = useState<Tab>("receipts");
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(() => toIsoDate(new Date()));

  const [receipts, setReceipts] = useState<FinanceReceiptsResponse | null>(
    null,
  );
  const [expenses, setExpenses] = useState<{
    total: number;
    items: FinanceExpense[];
  } | null>(null);
  const [debts, setDebts] = useState<ClientDebtRow[]>([]);
  const [debtQuery, setDebtQuery] = useState("");
  const [debtTotal, setDebtTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<{ fetchedAt: number } | null>(null);

  const [receiptDetail, setReceiptDetail] = useState<FinanceReceipt | null>(
    null,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);

  const debtOffsetRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        if (tab === "receipts") {
          const r = await fetchFinanceReceipts({
            dateFrom,
            dateTo,
            limit: 100,
          });
          setReceipts(r);
          setStale(null);
        } else if (tab === "expenses") {
          const r = await fetchFinanceExpenses(dateFrom, dateTo);
          setExpenses({
            total: Number(r.data.total_amount ?? 0),
            items: r.data.items ?? [],
          });
          setStale(r.stale ? { fetchedAt: r.fetchedAt } : null);
        } else {
          debtOffsetRef.current = 0;
          const r = await fetchClientsWithDebt({
            q: debtQuery.trim() || undefined,
            limit: 200,
          });
          const withDebt = (r.data.items ?? []).filter(
            (c) => Number(c.debt_amount) > 0,
          );
          setDebts(withDebt);
          setDebtTotal(withDebt.reduce((s, c) => s + Number(c.debt_amount), 0));
          setStale(r.stale ? { fetchedAt: r.fetchedAt } : null);
        }
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, dateFrom, dateTo, debtQuery, show],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const cancelReceipt = async () => {
    if (!receiptDetail) return;
    try {
      await deleteFinanceReceipt(receiptDetail.id);
      show("Поступление отменено", "success");
      setConfirmCancel(false);
      setReceiptDetail(null);
      void load(true);
    } catch (e) {
      show(describeError(e), "error");
    }
  };

  const totalsCard = receipts ? (
    <View
      className="mb-3 rounded-xl p-3"
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <View className="flex-row justify-between">
        <Text className="text-sm" style={{ color: colors.inkMuted }}>
          Итого поступило
        </Text>
        <Text className="text-base font-bold" style={{ color: colors.ink }}>
          {formatMoney(receipts.total_amount)}
        </Text>
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-xs" style={{ color: colors.inkMuted }}>
          Карта {formatMoney(receipts.totals.card)} · Нал{" "}
          {formatMoney(receipts.totals.cash)} · Безнал{" "}
          {formatMoney(receipts.totals.bank)}
        </Text>
        <Text className="text-xs" style={{ color: colors.inkMuted }}>
          {receipts.count} шт
        </Text>
      </View>
    </View>
  ) : null;

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <View className="mb-3 flex-row flex-wrap gap-2">
        <Chip
          label="Поступления"
          active={tab === "receipts"}
          onPress={() => setTab("receipts")}
        />
        <Chip
          label="Расходы"
          active={tab === "expenses"}
          onPress={() => setTab("expenses")}
        />
        <Chip
          label="Долги"
          active={tab === "debts"}
          onPress={() => setTab("debts")}
        />
      </View>

      {tab !== "debts" ? (
        <View className="mb-3 gap-2">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <DateField
                label="С"
                value={dateFrom}
                onChangeText={setDateFrom}
              />
            </View>
            <View className="flex-1">
              <DateField label="По" value={dateTo} onChangeText={setDateTo} />
            </View>
          </View>
        </View>
      ) : (
        <View
          className="mb-3 flex-row items-center gap-2 rounded-xl px-3"
          style={{ backgroundColor: colors.surfaceSubtle, height: 42 }}
        >
          <Ionicons name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={debtQuery}
            onChangeText={setDebtQuery}
            placeholder="Клиент"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 text-sm"
            style={{ color: colors.ink }}
          />
        </View>
      )}

      {stale ? <StaleDataBadge fetchedAt={stale.fetchedAt} /> : null}

      {loading ? (
        <SkeletonRows count={8} />
      ) : tab === "receipts" ? (
        <>
          {totalsCard}
          {(receipts?.items ?? []).length === 0 ? (
            <Text
              className="py-8 text-center text-sm"
              style={{ color: colors.inkMuted }}
            >
              Поступлений за период нет
            </Text>
          ) : (
            (receipts?.items ?? []).map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReceiptDetail(r)}
                className="mb-2 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {r.client_name}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkMuted }}
                      numberOfLines={1}
                    >
                      ЗН №{r.repair_order_number} ·{" "}
                      {PAYMENT_METHOD_LABELS[r.method] ?? r.method} ·{" "}
                      {formatDayMonth(r.paid_at ?? r.created_at)}{" "}
                      {formatTime(r.paid_at ?? r.created_at)}
                    </Text>
                  </View>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.success }}
                  >
                    +{formatMoney(r.amount)}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </>
      ) : tab === "expenses" ? (
        <>
          <View
            className="mb-3 flex-row items-center justify-between rounded-xl p-3"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              Всего расходов
            </Text>
            <Text
              className="text-base font-bold"
              style={{ color: colors.danger }}
            >
              −{formatMoney(expenses?.total ?? 0)}
            </Text>
          </View>
          {(expenses?.items ?? []).length === 0 ? (
            <Text
              className="py-8 text-center text-sm"
              style={{ color: colors.inkMuted }}
            >
              Расходов за период нет
            </Text>
          ) : (
            (expenses?.items ?? []).map((e) => (
              <View
                key={e.id}
                className="mb-2 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {e.article_name || e.type_label}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkMuted }}
                      numberOfLines={2}
                    >
                      {[
                        formatDayMonth(e.expense_date),
                        e.employee_name,
                        e.created_by_name,
                        e.description,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.danger }}
                  >
                    −{formatMoney(e.amount)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <View
            className="mb-3 flex-row items-center justify-between rounded-xl p-3"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              Долг клиентов
            </Text>
            <Text
              className="text-base font-bold"
              style={{ color: colors.danger }}
            >
              {formatMoney(debtTotal)}
            </Text>
          </View>
          {debts.length === 0 ? (
            <Text
              className="py-8 text-center text-sm"
              style={{ color: colors.inkMuted }}
            >
              Должников нет
            </Text>
          ) : (
            debts.map((c) => (
              <View
                key={c.id}
                className="mb-2 flex-row items-center rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.ink }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  <Text
                    className="mt-0.5 text-xs"
                    style={{ color: colors.inkMuted }}
                    numberOfLines={1}
                  >
                    {c.phone || "—"} · заказов: {c.orders_count} · оплачено{" "}
                    {formatMoney(c.paid_total)}
                  </Text>
                </View>
                <Text
                  className="ml-2 text-sm font-semibold"
                  style={{ color: colors.danger }}
                >
                  {formatMoney(c.debt_amount)}
                </Text>
                {c.phone ? (
                  <Pressable
                    onPress={() => void Linking.openURL(`tel:${c.phone}`)}
                    hitSlop={8}
                    className="ml-2"
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={colors.brand}
                    />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </>
      )}

      {/* Шторка поступления */}
      <Sheet
        visible={receiptDetail != null}
        title="Поступление"
        onClose={() => setReceiptDetail(null)}
      >
        {receiptDetail ? (
          <View className="gap-3">
            <View
              className="rounded-xl p-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: colors.ink }}
              >
                {formatMoney(receiptDetail.amount)} ·{" "}
                {PAYMENT_METHOD_LABELS[receiptDetail.method] ??
                  receiptDetail.method}
              </Text>
              <Text className="mt-1 text-sm" style={{ color: colors.inkSoft }}>
                {receiptDetail.client_name}
                {receiptDetail.client_phone
                  ? ` · ${receiptDetail.client_phone}`
                  : ""}
              </Text>
              <Text
                className="mt-0.5 text-xs"
                style={{ color: colors.inkMuted }}
              >
                Заказ-наряд №{receiptDetail.repair_order_number} ·{" "}
                {formatDayMonth(
                  receiptDetail.paid_at ?? receiptDetail.created_at,
                )}{" "}
                {formatTime(receiptDetail.paid_at ?? receiptDetail.created_at)}{" "}
                · №{receiptDetail.sequential_number}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                const id = receiptDetail.repair_order_id;
                setReceiptDetail(null);
                navigation.navigate("OrderDetail", { id });
              }}
              className="items-center rounded-xl py-3"
              style={{ backgroundColor: colors.brand }}
            >
              <Text className="text-sm font-semibold text-white">
                Открыть заказ-наряд
              </Text>
            </Pressable>
            {canCancelReceipt ? (
              <Pressable
                onPress={() => setConfirmCancel(true)}
                className="items-center rounded-xl py-3"
                style={{ backgroundColor: colors.dangerSoft }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.danger }}
                >
                  Отменить поступление
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={confirmCancel}
        title="Отменить поступление?"
        message={`Поступление на ${formatMoney(receiptDetail?.amount)} будет отменено, остаток к оплате по заказ-наряду увеличится.`}
        confirmLabel="Отменить поступление"
        destructive
        onConfirm={() => void cancelReceipt()}
        onCancel={() => setConfirmCancel(false)}
      />
    </Screen>
  );
}
