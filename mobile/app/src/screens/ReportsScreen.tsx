import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  fetchOrderEconomics,
  fetchPayrollReport,
  fetchRosskoSales,
  fetchWarehouseStock,
  shareReportXlsx,
  type OrderEconomicsResponse,
  type PayrollEmployeeRow,
  type PayrollReportResponse,
  type RosskoSalesResponse,
  type WarehouseStockResponse,
} from "../api/reports";
import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
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
import { UNIT_LABELS } from "../api/warehouse";

type Tab = "economics" | "stock" | "payroll" | "rossko";

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

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

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success" | "warning";
}) {
  const { colors } = useTheme();
  const toneColor =
    tone === "danger"
      ? colors.danger
      : tone === "success"
        ? colors.success
        : tone === "warning"
          ? colors.warning
          : colors.ink;
  return (
    <View
      className="mb-2 min-w-[48%] flex-1 rounded-xl p-3"
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <Text className="text-[10px]" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="mt-0.5 text-sm font-semibold"
        style={{ color: toneColor }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export function ReportsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const { user } = useSession();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>("economics");
  const [query, setQuery] = useState("");

  const canPayroll = Boolean(user?.isDirector);
  const canRossko = Boolean(user?.canSeeRosskoSalesReport);

  const [econ, setEcon] = useState<OrderEconomicsResponse | null>(null);
  const [stock, setStock] = useState<WarehouseStockResponse | null>(null);
  const [payroll, setPayroll] = useState<PayrollReportResponse | null>(null);
  const [rossko, setRossko] = useState<RosskoSalesResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<{ fetchedAt: number } | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [empSheet, setEmpSheet] = useState<PayrollEmployeeRow | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "economics", label: "Экономика" },
    { id: "stock", label: "Остатки" },
    ...(canPayroll ? [{ id: "payroll" as Tab, label: "Зарплата" }] : []),
    ...(canRossko ? [{ id: "rossko" as Tab, label: "Продажи Росско" }] : []),
  ];

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        if (tab === "economics") {
          const r = await fetchOrderEconomics(year, month, query);
          setEcon(r.data);
          setStale(r.stale ? { fetchedAt: r.fetchedAt } : null);
        } else if (tab === "stock") {
          const r = await fetchWarehouseStock(year, month, query);
          setStock(r.data);
          setStale(r.stale ? { fetchedAt: r.fetchedAt } : null);
        } else if (tab === "payroll") {
          const r = await fetchPayrollReport(year, month);
          setPayroll(r.data);
          setStale(r.stale ? { fetchedAt: r.fetchedAt } : null);
        } else {
          const r = await fetchRosskoSales(year, month, query);
          setRossko(r.data);
          setStale(r.stale ? { fetchedAt: r.fetchedAt } : null);
        }
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, year, month, query, show],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), tab === "payroll" ? 0 : 400);
    return () => clearTimeout(t);
  }, [load, tab]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const downloadXlsx = async () => {
    if (xlsxBusy) return;
    const kind =
      tab === "economics"
        ? ("order-economics" as const)
        : tab === "stock"
          ? ("warehouse-stock" as const)
          : tab === "payroll"
            ? ("payroll" as const)
            : ("rossko-sales" as const);
    setXlsxBusy(true);
    try {
      await shareReportXlsx(kind, year, month, query);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setXlsxBusy(false);
    }
  };

  const supportsSearch = tab !== "payroll";

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      {/* Вкладки */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
      >
        {tabs.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            active={tab === t.id}
            onPress={() => setTab(t.id)}
          />
        ))}
      </ScrollView>

      {/* Месяц + поиск + xlsx */}
      <View className="mb-3 flex-row items-center gap-2">
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={colors.inkSoft} />
        </Pressable>
        <Text
          className="flex-1 text-center text-sm font-semibold"
          style={{ color: colors.ink }}
        >
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={colors.inkSoft} />
        </Pressable>
        <Pressable
          onPress={() => void downloadXlsx()}
          disabled={xlsxBusy}
          hitSlop={8}
          className="rounded-lg p-1.5"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Ionicons
            name={xlsxBusy ? "hourglass-outline" : "download-outline"}
            size={18}
            color={colors.brand}
          />
        </Pressable>
      </View>

      {supportsSearch ? (
        <View
          className="mb-3 flex-row items-center gap-2 rounded-xl px-3"
          style={{ backgroundColor: colors.surfaceSubtle, height: 40 }}
        >
          <Ionicons name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 text-sm"
            style={{ color: colors.ink }}
          />
        </View>
      ) : null}

      {stale ? <StaleDataBadge fetchedAt={stale.fetchedAt} /> : null}

      {loading ? (
        <SkeletonRows count={8} />
      ) : tab === "economics" ? (
        econ ? (
          <>
            <View className="flex-row flex-wrap gap-2">
              <SummaryTile
                label="Выручка"
                value={formatMoney(econ.summary.revenue)}
              />
              <SummaryTile
                label="Себестоимость ЗЧ"
                value={formatMoney(econ.summary.parts_cost)}
              />
              <SummaryTile
                label="ФОТ"
                value={formatMoney(econ.summary.payroll_total)}
              />
              <SummaryTile
                label="Прибыль"
                value={formatMoney(econ.summary.net_profit)}
                tone={econ.summary.net_profit >= 0 ? "success" : "danger"}
              />
              <SummaryTile
                label="Оплачено"
                value={formatMoney(econ.summary.paid_amount)}
                tone="success"
              />
              <SummaryTile
                label="Долг"
                value={formatMoney(econ.summary.debt_amount)}
                tone={econ.summary.debt_amount > 0 ? "danger" : undefined}
              />
            </View>
            <Text
              className="mb-2 mt-2 text-xs"
              style={{ color: colors.inkMuted }}
            >
              {econ.summary.count} заказ-нарядов · не оплачено:{" "}
              {econ.summary.unpaid_count}
            </Text>
            {econ.items.map((o) => (
              <Pressable
                key={o.order_id}
                onPress={() =>
                  navigation.navigate("OrderDetail", { id: o.order_id })
                }
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
                      №{o.order_number} · {o.client_name}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkMuted }}
                      numberOfLines={1}
                    >
                      {formatDayMonth(o.scheduled_at)}
                      {o.vehicle?.make
                        ? ` · ${o.vehicle.make} ${o.vehicle.model ?? ""}`
                        : ""}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.ink }}
                    >
                      {formatMoney(o.grand_total)}
                    </Text>
                    <Text
                      className="text-[10px]"
                      style={{
                        color:
                          o.payment_status === "paid"
                            ? colors.success
                            : o.payment_status === "partial"
                              ? colors.warning
                              : colors.danger,
                      }}
                    >
                      {o.payment_status === "paid"
                        ? "Оплачен"
                        : o.payment_status === "partial"
                          ? "Частично"
                          : "Не оплачен"}
                    </Text>
                  </View>
                </View>
                <View className="mt-1 flex-row justify-between">
                  <Text
                    className="text-[10px]"
                    style={{ color: colors.inkMuted }}
                  >
                    ЗЧ {formatMoney(o.parts_cost)} · ФОТ{" "}
                    {formatMoney(o.payroll_total)}
                  </Text>
                  <Text
                    className="text-[10px] font-medium"
                    style={{
                      color:
                        Number(o.net_profit) >= 0
                          ? colors.success
                          : colors.danger,
                    }}
                  >
                    прибыль {formatMoney(o.net_profit)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null
      ) : tab === "stock" ? (
        stock ? (
          <>
            <View className="flex-row flex-wrap gap-2">
              <SummaryTile
                label="Позиций"
                value={String(stock.summary.positions)}
              />
              <SummaryTile
                label="Сумма остатков"
                value={formatMoney(stock.summary.closing_value)}
              />
              <SummaryTile
                label="Приход / Расход"
                value={`${stock.summary.received_qty} / ${stock.summary.expensed_qty}`}
              />
            </View>
            {stock.items.map((item) => (
              <View
                key={item.id}
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
                      {item.name}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs"
                      style={{ color: colors.inkMuted }}
                      numberOfLines={1}
                    >
                      {[item.brand, item.article].filter(Boolean).join(" · ") ||
                        "—"}{" "}
                      · остаток {item.closing_qty}{" "}
                      {UNIT_LABELS[item.unit] ?? item.unit}
                      {item.available_qty != null
                        ? ` (доступно ${item.available_qty})`
                        : ""}
                    </Text>
                  </View>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.ink }}
                  >
                    {formatMoney(item.stock_amount)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : null
      ) : tab === "payroll" ? (
        payroll ? (
          <>
            <View className="flex-row flex-wrap gap-2">
              <SummaryTile
                label="Начислено"
                value={formatMoney(payroll.total)}
              />
              <SummaryTile
                label="Выдано"
                value={formatMoney(payroll.total_paid)}
                tone="success"
              />
              <SummaryTile
                label="Остаток"
                value={formatMoney(payroll.total_remaining)}
                tone={
                  Number(payroll.total_remaining) > 0 ? "warning" : undefined
                }
              />
            </View>
            {payroll.employees.length === 0 ? (
              <Text
                className="py-8 text-center text-sm"
                style={{ color: colors.inkMuted }}
              >
                Нет данных за месяц
              </Text>
            ) : (
              payroll.employees.map((emp) => (
                <Pressable
                  key={emp.employee_id}
                  onPress={() => setEmpSheet(emp)}
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
                        {emp.name}
                      </Text>
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: colors.inkMuted }}
                      >
                        заказов: {emp.completed_orders}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.ink }}
                      >
                        {formatMoney(emp.total)}
                      </Text>
                      <Text
                        className="text-[10px]"
                        style={{ color: colors.inkMuted }}
                      >
                        выдано {formatMoney(emp.paid)} · остаток{" "}
                        {formatMoney(emp.remaining)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </>
        ) : null
      ) : rossko ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <SummaryTile label="Продаж" value={String(rossko.summary.count)} />
            <SummaryTile
              label="Выручка"
              value={formatMoney(rossko.summary.sale_total)}
            />
            <SummaryTile
              label="Закупка"
              value={formatMoney(rossko.summary.supplier_total)}
            />
            <SummaryTile
              label="Маржа"
              value={formatMoney(rossko.summary.margin)}
              tone={Number(rossko.summary.margin) >= 0 ? "success" : "danger"}
            />
            <SummaryTile
              label="Возвраты"
              value={formatMoney(rossko.summary.refund_total)}
              tone={
                Number(rossko.summary.refund_total) > 0 ? "warning" : undefined
              }
            />
            {rossko.summary.pending_count > 0 ? (
              <SummaryTile
                label="Ожидают эквайринга"
                value={String(rossko.summary.pending_count)}
                tone="warning"
              />
            ) : null}
          </View>
          {rossko.items.map((o) => (
            <View
              key={o.order_id}
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
                    {o.buyer_name || "Покупатель"}
                    {o.rossko_order_id ? ` · ${o.rossko_order_id}` : ""}
                  </Text>
                  <Text
                    className="mt-0.5 text-xs"
                    style={{ color: colors.inkMuted }}
                    numberOfLines={1}
                  >
                    {formatDayMonth(o.operation_at)}
                    {o.payment_method_label
                      ? ` · ${o.payment_method_label}`
                      : ""}
                    {o.is_paid ? "" : " · не оплачен"}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.ink }}
                  >
                    {formatMoney(o.sale_total)}
                  </Text>
                  {o.margin != null ? (
                    <Text
                      className="text-[10px]"
                      style={{
                        color:
                          Number(o.margin) >= 0
                            ? colors.success
                            : colors.danger,
                      }}
                    >
                      маржа {formatMoney(o.margin)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </>
      ) : null}

      {/* Шторка: заказы сотрудника */}
      <Sheet
        visible={empSheet != null}
        title={empSheet?.name ?? ""}
        onClose={() => setEmpSheet(null)}
      >
        <ScrollView className="max-h-96">
          {(empSheet?.orders ?? []).map((o) => (
            <Pressable
              key={o.order_id}
              onPress={() => {
                setEmpSheet(null);
                navigation.navigate("OrderDetail", { id: o.order_id });
              }}
              className="mb-2 flex-row items-center justify-between rounded-xl p-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.ink }}
                  numberOfLines={1}
                >
                  ЗН №{o.order_number}
                </Text>
                <Text className="text-xs" style={{ color: colors.inkMuted }}>
                  {o.vehicle?.make
                    ? `${o.vehicle.make} ${o.vehicle.model ?? ""}`
                    : "—"}{" "}
                  · {formatDayMonth(o.end_at)}
                </Text>
              </View>
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.ink }}
              >
                {formatMoney(o.amount)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
