import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  deleteFinanceExpense,
  deleteFinanceReceipt,
  fetchClientsWithDebt,
  fetchFinanceExpenses,
  fetchFinanceReceipts,
  patchFinanceReceipt,
  PAYMENT_METHOD_LABELS,
  shareFinanceExpensesXlsx,
  shareFinanceReceiptsXlsx,
  type ClientDebtRow,
  type FinanceExpense,
  type FinanceReceipt,
  type FinanceReceiptsResponse,
  type PaymentMethod,
} from "../api/finance";
import { canAccessSection } from "../auth/access";
import { currentPermissionCodes } from "../auth/permissions";
import { useSession } from "../auth/session";
import { describeError } from "../api/errors";
import { ExpenseFormSheet } from "../components/finance/ExpenseFormSheet";
import {
  ConfirmDialog,
  DatePickerField,
  Screen,
  Sheet,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { pageFiltersKey } from "../storage/keys";
import { usePersistedState } from "../storage/usePersistedState";
import { useTheme } from "../theme/useTheme";
import {
  formatMoney,
  formatServerDate,
  formatServerDateTime,
  plural,
  toDateInputValue,
  toIsoDate,
} from "../utils/format";

type Tab = "receipts" | "expenses" | "debts";
type ReceiptMethodFilter = "all" | PaymentMethod;
type ExpenseTypeFilter = "all" | "salary" | "other";

const METHOD_OPTIONS: { id: ReceiptMethodFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "card", label: "Карта" },
  { id: "cash", label: "Наличные" },
  { id: "bank", label: "Расчётный счёт" },
];

const EXPENSE_TYPE_OPTIONS: { id: ExpenseTypeFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "salary", label: "Зарплата" },
  { id: "other", label: "Прочее" },
];

const TABS: { id: Tab; label: string }[] = [
  { id: "receipts", label: "Поступления" },
  { id: "expenses", label: "Расходы" },
  { id: "debts", label: "Долги" },
];

interface FinanceFilters {
  dateFrom: string;
  dateTo: string;
  method: ReceiptMethodFilter;
  expenseType: ExpenseTypeFilter;
  tab: Tab;
}

function monthStart(): string {
  const d = new Date();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function defaultFinanceFilters(): FinanceFilters {
  return {
    dateFrom: monthStart(),
    dateTo: toIsoDate(new Date()),
    method: "all",
    expenseType: "all",
    tab: "receipts",
  };
}

function isIsoDate(value: string | null | undefined): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}

function sanitizeFinanceFilters(
  value: Partial<FinanceFilters> | null | undefined,
): FinanceFilters {
  const defaults = defaultFinanceFilters();
  const today = toIsoDate(new Date());
  let dateFrom = isIsoDate(value?.dateFrom)
    ? value!.dateFrom!
    : defaults.dateFrom;
  let dateTo = isIsoDate(value?.dateTo) ? value!.dateTo! : defaults.dateTo;
  if (dateFrom > today) dateFrom = today;
  if (dateTo > today) dateTo = today;
  if (dateFrom > dateTo) dateTo = dateFrom;
  const method = METHOD_OPTIONS.some((o) => o.id === value?.method)
    ? (value!.method as ReceiptMethodFilter)
    : "all";
  const expenseType = EXPENSE_TYPE_OPTIONS.some(
    (o) => o.id === value?.expenseType,
  )
    ? (value!.expenseType as ExpenseTypeFilter)
    : "all";
  const tab = TABS.some((o) => o.id === value?.tab)
    ? (value!.tab as Tab)
    : "receipts";
  return { dateFrom, dateTo, method, expenseType, tab };
}

function isoToLocalDate(value: string | null | undefined): Date | null {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = value!.split("-").map(Number);
  return new Date(year, month - 1, day);
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

function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
      className="mb-2"
    >
      {options.map((option) => (
        <Chip
          key={option.id}
          label={option.label}
          active={value === option.id}
          onPress={() => onChange(option.id)}
        />
      ))}
    </ScrollView>
  );
}

function FilterButton({
  open,
  count,
  onPress,
}: {
  open: boolean;
  count: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1 rounded-full px-3 py-2"
      style={{
        backgroundColor: open ? colors.brandSoft : colors.surfaceSubtle,
      }}
      accessibilityRole="button"
      accessibilityLabel="Период"
      accessibilityState={{ expanded: open }}
    >
      <Ionicons
        name={open ? "chevron-up" : "calendar-outline"}
        size={15}
        color={open ? colors.brand : colors.inkMuted}
      />
      <Text
        className="text-xs font-medium"
        style={{ color: open ? colors.brand : colors.inkSoft }}
      >
        Период
      </Text>
      {count > 0 ? (
        <View
          className="rounded-full px-1.5 py-0.5"
          style={{ backgroundColor: colors.brand }}
        >
          <Text className="text-[10px] font-semibold" style={{ color: "#fff" }}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ExportButton({
  busy,
  disabled,
  onPress,
}: {
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      className="rounded-full p-2"
      style={{ backgroundColor: colors.surfaceSubtle }}
      accessibilityRole="button"
      accessibilityLabel="Экспорт в Excel"
    >
      <Ionicons
        name={busy ? "hourglass-outline" : "download-outline"}
        size={18}
        color={disabled ? colors.inkFaint : colors.brand}
      />
    </Pressable>
  );
}

function FinanceField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-xs" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="flex-1 text-right text-xs font-medium"
        style={{ color: colors.ink }}
      >
        {children}
      </Text>
    </View>
  );
}

function MethodBadge({ method }: { method: PaymentMethod }) {
  const { colors } = useTheme();
  const palette =
    method === "card"
      ? { bg: colors.brandSoft, fg: colors.brand }
      : method === "cash"
        ? { bg: colors.successSoft, fg: colors.success }
        : { bg: colors.warningSoft, fg: colors.warning };
  return (
    <View
      className="self-start rounded-full px-2 py-0.5"
      style={{ backgroundColor: palette.bg }}
    >
      <Text className="text-[10px] font-semibold" style={{ color: palette.fg }}>
        {PAYMENT_METHOD_LABELS[method] ?? method}
      </Text>
    </View>
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
  const canManageExpenses =
    canAccessSection(user, codes, "finance") ||
    canAccessSection(user, codes, "reports");

  const filterDefaults = useMemo(() => defaultFinanceFilters(), []);
  const [filtersStored, setFiltersStored] = usePersistedState<FinanceFilters>(
    pageFiltersKey("finance"),
    filterDefaults,
  );
  const filters = useMemo(
    () => sanitizeFinanceFilters(filtersStored),
    [filtersStored],
  );
  const { dateFrom, dateTo, method, expenseType, tab } = filters;
  const updateFilters = useCallback(
    (patch: Partial<FinanceFilters>) => {
      setFiltersStored((prev) => ({
        ...sanitizeFinanceFilters(prev),
        ...patch,
      }));
    },
    [setFiltersStored],
  );

  const [receipts, setReceipts] = useState<FinanceReceiptsResponse | null>(
    null,
  );
  const [expenses, setExpenses] = useState<{
    total: number;
    count: number;
    items: FinanceExpense[];
  } | null>(null);
  const [debts, setDebts] = useState<ClientDebtRow[]>([]);
  const [debtQuery, setDebtQuery] = useState("");
  const [debtTotal, setDebtTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<{ fetchedAt: number } | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [receiptDetail, setReceiptDetail] = useState<FinanceReceipt | null>(
    null,
  );
  const [savingReceiptDate, setSavingReceiptDate] = useState(false);
  const [confirmCancelReceipt, setConfirmCancelReceipt] = useState(false);
  const [cancelingReceipt, setCancelingReceipt] = useState(false);

  const [expenseDetail, setExpenseDetail] = useState<FinanceExpense | null>(
    null,
  );
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState<{
    open: boolean;
    initial: FinanceExpense | null;
  }>({ open: false, initial: null });

  const debtOffsetRef = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        if (tab === "receipts") {
          const r = await fetchFinanceReceipts({ dateFrom, dateTo });
          setReceipts(r);
          setStale(null);
        } else if (tab === "expenses") {
          const r = await fetchFinanceExpenses(dateFrom, dateTo);
          setExpenses({
            total: Number(r.data.total_amount ?? 0),
            count: Number(r.data.count ?? 0),
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

  const openOrder = useCallback(
    (orderId: number) => {
      navigation.navigate("OrderDetail", { id: orderId });
    },
    [navigation],
  );

  const saveReceiptDate = async (paidAt: string) => {
    if (!receiptDetail || !paidAt || !canCancelReceipt) return;
    const current = toDateInputValue(
      receiptDetail.paid_at ?? receiptDetail.created_at,
    );
    if (paidAt === current) return;
    setSavingReceiptDate(true);
    try {
      const updated = await patchFinanceReceipt(receiptDetail.id, {
        paid_at: paidAt,
      });
      setReceiptDetail(updated);
      setReceipts((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : prev,
      );
      void load(true);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSavingReceiptDate(false);
    }
  };

  const cancelReceipt = async () => {
    if (!receiptDetail || cancelingReceipt) return;
    setCancelingReceipt(true);
    try {
      await deleteFinanceReceipt(receiptDetail.id);
      show("Поступление отменено", "success");
      setConfirmCancelReceipt(false);
      setReceiptDetail(null);
      void load(true);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setCancelingReceipt(false);
    }
  };

  const deleteExpense = async () => {
    if (!expenseDetail || deletingExpense) return;
    setDeletingExpense(true);
    try {
      await deleteFinanceExpense(expenseDetail.id);
      show("Расход удалён", "success");
      setConfirmDeleteExpense(false);
      setExpenseDetail(null);
      void load(true);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setDeletingExpense(false);
    }
  };

  const exportReport = async () => {
    if (xlsxBusy || tab === "debts") return;
    setXlsxBusy(true);
    try {
      if (tab === "receipts") {
        await shareFinanceReceiptsXlsx(dateFrom, dateTo);
      } else {
        await shareFinanceExpensesXlsx(dateFrom, dateTo);
      }
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setXlsxBusy(false);
    }
  };

  const receiptItems = useMemo(() => receipts?.items ?? [], [receipts]);
  const filteredReceipts = useMemo(
    () =>
      method === "all"
        ? receiptItems
        : receiptItems.filter((r) => r.method === method),
    [receiptItems, method],
  );
  const receiptsTotal =
    method === "all"
      ? Number(receipts?.total_amount ?? 0)
      : filteredReceipts.reduce((s, r) => s + Number(r.amount || 0), 0);

  const expenseItems = useMemo(() => expenses?.items ?? [], [expenses]);
  const filteredExpenses = useMemo(
    () =>
      expenseType === "all"
        ? expenseItems
        : expenseItems.filter((e) => e.type === expenseType),
    [expenseItems, expenseType],
  );
  const expensesTotal =
    expenseType === "all"
      ? (expenses?.total ?? 0)
      : filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const todayDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(todayDate), [todayDate]);
  const dateFromMaxDate =
    dateTo < todayIso ? (isoToLocalDate(dateTo) ?? todayDate) : todayDate;
  const dateToMinDate = isoToLocalDate(dateFrom) ?? todayDate;
  const periodChanged =
    dateFrom !== filterDefaults.dateFrom || dateTo !== filterDefaults.dateTo;

  const receiptDateValue = receiptDetail
    ? toDateInputValue(receiptDetail.paid_at ?? receiptDetail.created_at)
    : "";

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
      >
        {TABS.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={tab === item.id}
            onPress={() => updateFilters({ tab: item.id })}
          />
        ))}
      </ScrollView>

      {tab !== "debts" ? (
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <FilterButton
            open={filtersOpen}
            count={periodChanged ? 1 : 0}
            onPress={() => setFiltersOpen((prev) => !prev)}
          />
          <View className="flex-1" />
          {tab === "expenses" && canManageExpenses ? (
            <Pressable
              onPress={() => setExpenseForm({ open: true, initial: null })}
              className="flex-row items-center gap-1 rounded-full px-3 py-2"
              style={{ backgroundColor: colors.brand }}
              accessibilityRole="button"
              accessibilityLabel="Добавить расход"
            >
              <Ionicons name="add" size={15} color="#fff" />
              <Text className="text-xs font-semibold" style={{ color: "#fff" }}>
                Расход
              </Text>
            </Pressable>
          ) : null}
          <ExportButton
            busy={xlsxBusy}
            disabled={loading}
            onPress={() => void exportReport()}
          />
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

      {tab === "receipts" ? (
        <ChipRow
          options={METHOD_OPTIONS}
          value={method}
          onChange={(value) => updateFilters({ method: value })}
        />
      ) : tab === "expenses" ? (
        <ChipRow
          options={EXPENSE_TYPE_OPTIONS}
          value={expenseType}
          onChange={(value) => updateFilters({ expenseType: value })}
        />
      ) : null}

      {filtersOpen && tab !== "debts" ? (
        <View
          className="mb-3 gap-3 rounded-xl p-3"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Период
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <DatePickerField
                label="С"
                value={dateFrom}
                onChange={(value) =>
                  updateFilters({
                    dateFrom: value,
                    dateTo: value > dateTo ? value : dateTo,
                  })
                }
                maximumDate={dateFromMaxDate}
              />
            </View>
            <View className="flex-1">
              <DatePickerField
                label="По"
                value={dateTo}
                onChange={(value) =>
                  updateFilters({
                    dateTo: value,
                    dateFrom: value < dateFrom ? value : dateFrom,
                  })
                }
                minimumDate={dateToMinDate}
                maximumDate={todayDate}
              />
            </View>
          </View>
        </View>
      ) : null}

      {stale ? <StaleDataBadge fetchedAt={stale.fetchedAt} /> : null}

      {loading ? (
        <SkeletonRows count={8} />
      ) : tab === "receipts" ? (
        <>
          <View
            className="mb-3 rounded-xl p-3"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-sm" style={{ color: colors.inkMuted }}>
                {method === "all"
                  ? "Итого поступило"
                  : `Итого · ${METHOD_OPTIONS.find((o) => o.id === method)?.label ?? ""}`}
              </Text>
              <Text
                className="text-base font-bold"
                style={{ color: colors.ink }}
              >
                {formatMoney(receiptsTotal)}
              </Text>
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-xs" style={{ color: colors.inkMuted }}>
                Карта {formatMoney(receipts?.totals.card)} · Нал{" "}
                {formatMoney(receipts?.totals.cash)} · Расчётный{" "}
                {formatMoney(receipts?.totals.bank)}
              </Text>
              <Text className="text-xs" style={{ color: colors.inkMuted }}>
                {filteredReceipts.length}{" "}
                {plural(
                  filteredReceipts.length,
                  "поступление",
                  "поступления",
                  "поступлений",
                )}
              </Text>
            </View>
          </View>
          {filteredReceipts.length === 0 ? (
            <Text
              className="py-8 text-center text-sm"
              style={{ color: colors.inkMuted }}
            >
              Нет поступлений за период
            </Text>
          ) : (
            filteredReceipts.map((r) => (
              <View
                key={r.id}
                className="mb-2 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <Pressable
                  onPress={() => setReceiptDetail(r)}
                  accessibilityRole="button"
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="min-w-0 flex-1">
                      <Text
                        className="text-sm font-medium"
                        style={{ color: colors.ink }}
                        numberOfLines={1}
                      >
                        {r.client_name || "—"}
                      </Text>
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: colors.inkMuted }}
                        numberOfLines={1}
                      >
                        {formatServerDateTime(r.paid_at ?? r.created_at)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.success }}
                      >
                        +{formatMoney(r.amount)}
                      </Text>
                      <View className="mt-1">
                        <MethodBadge method={r.method} />
                      </View>
                    </View>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => openOrder(r.repair_order_id)}
                  className="mt-1.5 self-start"
                  hitSlop={6}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: colors.brand }}
                  >
                    Заказ-наряд № {r.repair_order_number}
                  </Text>
                </Pressable>
              </View>
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
              {expenseType === "all"
                ? "Всего расходов"
                : `Итого · ${EXPENSE_TYPE_OPTIONS.find((o) => o.id === expenseType)?.label ?? ""}`}
            </Text>
            <Text
              className="text-base font-bold"
              style={{ color: colors.danger }}
            >
              −{formatMoney(expensesTotal)}
            </Text>
          </View>
          {filteredExpenses.length === 0 ? (
            <Text
              className="py-8 text-center text-sm"
              style={{ color: colors.inkMuted }}
            >
              {expenseType === "all"
                ? "Нет расходов за период"
                : "Нет расходов этого вида"}
            </Text>
          ) : (
            filteredExpenses.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => setExpenseDetail(e)}
                className="mb-2 rounded-xl p-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
                accessibilityRole="button"
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {e.article_name || e.type_label || e.type}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkMuted }}
                      numberOfLines={1}
                    >
                      {formatServerDate(e.expense_date)}
                      {e.employee_name ? ` · ${e.employee_name}` : ""}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkMuted }}
                      numberOfLines={1}
                    >
                      {e.created_by_name}
                    </Text>
                    {e.description ? (
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: colors.inkMuted }}
                        numberOfLines={2}
                      >
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.danger }}
                  >
                    −{formatMoney(e.amount)}
                  </Text>
                </View>
              </Pressable>
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
        title={
          receiptDetail
            ? `Поступление № ${receiptDetail.sequential_number}`
            : "Поступление"
        }
        onClose={() => setReceiptDetail(null)}
      >
        {receiptDetail ? (
          <View className="gap-2">
            <FinanceField label="Клиент">
              {receiptDetail.client_name || "—"}
            </FinanceField>
            <FinanceField label="Телефон">
              {receiptDetail.client_phone || "—"}
            </FinanceField>
            <View className="flex-row justify-between gap-3">
              <Text className="text-xs" style={{ color: colors.inkMuted }}>
                Заказ-наряд
              </Text>
              <Pressable
                onPress={() => {
                  const id = receiptDetail.repair_order_id;
                  setReceiptDetail(null);
                  openOrder(id);
                }}
                className="flex-1"
              >
                <Text
                  className="text-right text-xs font-medium"
                  style={{ color: colors.brand }}
                >
                  № {receiptDetail.repair_order_number || "—"}
                </Text>
              </Pressable>
            </View>
            <FinanceField label="Способ">
              {PAYMENT_METHOD_LABELS[receiptDetail.method] ??
                receiptDetail.method}
            </FinanceField>
            <FinanceField label="Сумма">
              {formatMoney(receiptDetail.amount)}
            </FinanceField>
            <View className="flex-row items-center justify-between gap-3 pt-1">
              <Text className="text-xs" style={{ color: colors.inkMuted }}>
                Дата
              </Text>
              {canCancelReceipt ? (
                <View className="flex-1">
                  <DatePickerField
                    value={receiptDateValue}
                    onChange={(value) => void saveReceiptDate(value)}
                    maximumDate={todayDate}
                  />
                </View>
              ) : (
                <Text
                  className="flex-1 text-right text-xs font-medium"
                  style={{ color: colors.ink }}
                >
                  {formatServerDateTime(
                    receiptDetail.paid_at ?? receiptDetail.created_at,
                  )}
                </Text>
              )}
            </View>
            {savingReceiptDate ? (
              <View className="flex-row items-center justify-end gap-2 pt-1">
                <ActivityIndicator size="small" color={colors.brand} />
                <Text className="text-xs" style={{ color: colors.inkMuted }}>
                  Сохранение…
                </Text>
              </View>
            ) : null}
            <View className="mt-2 gap-2">
              <Pressable
                onPress={() => {
                  const id = receiptDetail.repair_order_id;
                  setReceiptDetail(null);
                  openOrder(id);
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
                  onPress={() => setConfirmCancelReceipt(true)}
                  disabled={cancelingReceipt}
                  className="items-center rounded-xl py-3"
                  style={{ backgroundColor: colors.dangerSoft }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.danger }}
                  >
                    {cancelingReceipt ? "Отмена…" : "Отменить поступление"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* Шторка расхода */}
      <Sheet
        visible={expenseDetail != null}
        title="Детали расхода"
        onClose={() => setExpenseDetail(null)}
      >
        {expenseDetail ? (
          <View className="gap-2">
            <FinanceField label="Статья расхода">
              {expenseDetail.article_name ||
                expenseDetail.type_label ||
                expenseDetail.type}
            </FinanceField>
            <FinanceField label="Сумма">
              {formatMoney(expenseDetail.amount)}
            </FinanceField>
            <FinanceField label="Дата">
              {formatServerDate(expenseDetail.expense_date)}
            </FinanceField>
            <FinanceField label="Ответственный">
              {expenseDetail.employee_name ||
                expenseDetail.created_by_name ||
                "—"}
            </FinanceField>
            {expenseDetail.description ? (
              <FinanceField label="Описание">
                {expenseDetail.description}
              </FinanceField>
            ) : null}
            {canManageExpenses ? (
              <View className="mt-2 gap-2">
                <Pressable
                  onPress={() => {
                    setExpenseForm({ open: true, initial: expenseDetail });
                    setExpenseDetail(null);
                  }}
                  className="items-center rounded-xl py-3"
                  style={{ backgroundColor: colors.brand }}
                >
                  <Text className="text-sm font-semibold text-white">
                    Редактировать
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDeleteExpense(true)}
                  disabled={deletingExpense}
                  className="items-center rounded-xl py-3"
                  style={{ backgroundColor: colors.dangerSoft }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.danger }}
                  >
                    {deletingExpense ? "Удаление…" : "Удалить расход"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>

      {/* Форма расхода */}
      {expenseForm.open ? (
        <ExpenseFormSheet
          initial={expenseForm.initial}
          onClose={() => setExpenseForm({ open: false, initial: null })}
          onSaved={() => void load(true)}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmCancelReceipt}
        title="Отменить поступление?"
        message={
          receiptDetail
            ? `Поступление № ${receiptDetail.sequential_number} на сумму ${formatMoney(receiptDetail.amount)} по заказ-наряду № ${receiptDetail.repair_order_number} будет удалено.`
            : ""
        }
        confirmLabel="Удалить"
        destructive
        onConfirm={() => void cancelReceipt()}
        onCancel={() => setConfirmCancelReceipt(false)}
      />

      <ConfirmDialog
        visible={confirmDeleteExpense}
        title="Удалить расход?"
        message={
          expenseDetail
            ? `Расход «${expenseDetail.article_name || expenseDetail.type_label}» на сумму ${formatMoney(expenseDetail.amount)} будет удалён.`
            : ""
        }
        confirmLabel="Удалить"
        destructive
        onConfirm={() => void deleteExpense()}
        onCancel={() => setConfirmDeleteExpense(false)}
      />
    </Screen>
  );
}
