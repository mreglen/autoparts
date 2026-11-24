import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  fetchOrderEconomics,
  fetchPayrollReport,
  fetchWarehouseStock,
  orderEconomicsPath,
  payrollPath,
  shareReportXlsx,
  warehouseStockPath,
  type OrderEconomicsPaymentFilter,
  type OrderEconomicsResponse,
  type OrderEconomicsRow,
  type OrderEconomicsStatusFilter,
  type PayrollEmployeeRow,
  type PayrollReportResponse,
  type ReportVehicle,
  type WarehouseStockResponse,
  type WarehouseStockRow,
} from "../api/reports";
import { UNIT_LABELS } from "../api/warehouse";
import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
import {
  AppHeader,
  DatePickerField,
  NativeDatePicker,
  Screen,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import { cardChrome, inputChrome } from "../components/ui/chrome";
import type { RootStackParamList } from "../navigation/types";
import { pageFiltersKey } from "../storage/keys";
import { usePersistedState } from "../storage/usePersistedState";
import { useTheme } from "../theme/useTheme";
import {
  formatMoney,
  formatServerDate,
  formatWallClockDateTime,
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
  orderStatusLabel,
  plural,
  toIsoDate,
} from "../utils/format";
import { orderStatusColor, orderStatusSoft } from "../utils/orderStatusColors";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

type Tab = "economics" | "stock" | "payroll";

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

const ECONOMICS_STATUS_OPTIONS: {
  id: OrderEconomicsStatusFilter;
  label: string;
}[] = [
  { id: "all", label: "Все" },
  { id: "pending", label: "Ожидание" },
  { id: "in_progress", label: "В работе" },
  { id: "done", label: "Выполнен" },
  { id: "completed", label: "Закрыт" },
  { id: "cancelled", label: "Отменён" },
];

const ECONOMICS_PAYMENT_OPTIONS: {
  id: OrderEconomicsPaymentFilter;
  label: string;
}[] = [
  { id: "all", label: "Все" },
  { id: "paid", label: "Оплачено" },
  { id: "partial", label: "Частично" },
  { id: "unpaid", label: "Дебит" },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Оплачено",
  partial: "Частично",
  unpaid: "Дебит",
};

interface EconomicsFilters {
  dateFrom: string;
  dateTo: string;
  status: OrderEconomicsStatusFilter;
  payment: OrderEconomicsPaymentFilter;
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isMonthValue(value: string | null | undefined): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "");
}

function parseMonthValue(
  value: string | null | undefined,
): { year: number; month: number } | null {
  if (!isMonthValue(value)) return null;
  const [year, month] = value!.split("-").map(Number);
  return { year, month };
}

function monthLabel(value: string): string {
  const parsed = parseMonthValue(value);
  if (!parsed) return value || "—";
  return `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`;
}

function defaultEconomicsFilters(): EconomicsFilters {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: toIsoDate(first),
    dateTo: toIsoDate(now),
    status: "all",
    payment: "all",
  };
}

function isIsoDate(value: string | null | undefined): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");
}

function sanitizeEconomicsFilters(
  value: Partial<EconomicsFilters> | null | undefined,
): EconomicsFilters {
  const defaults = defaultEconomicsFilters();
  const status = ECONOMICS_STATUS_OPTIONS.some((o) => o.id === value?.status)
    ? (value!.status as OrderEconomicsStatusFilter)
    : "all";
  const payment = ECONOMICS_PAYMENT_OPTIONS.some((o) => o.id === value?.payment)
    ? (value!.payment as OrderEconomicsPaymentFilter)
    : "all";
  let dateFrom = isIsoDate(value?.dateFrom)
    ? value!.dateFrom!
    : defaults.dateFrom;
  let dateTo = isIsoDate(value?.dateTo) ? value!.dateTo! : defaults.dateTo;
  const today = toIsoDate(new Date());
  if (dateFrom > today) dateFrom = today;
  if (dateTo > today) dateTo = today;
  if (dateFrom > dateTo) dateTo = dateFrom;
  return { dateFrom, dateTo, status, payment };
}

function isoToLocalDate(value: string | null | undefined): Date | null {
  if (!isIsoDate(value)) return null;
  const [year, month, day] = value!.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function vehicleLabel(vehicle?: ReportVehicle | null): string {
  if (!vehicle) return "—";
  const parts = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean);
  const base = parts.join(" ") || "Авто";
  return vehicle.plate ? `${base} (${vehicle.plate})` : base;
}

function warehouseStockNameParts(row: WarehouseStockRow): {
  primary: string;
  secondary: string;
} {
  const brand = String(row.brand || "").trim();
  const article = String(row.article || "").trim();
  const name = String(row.name || "").trim();
  const codeLine = [brand, article].filter(Boolean).join(" ");
  if (
    codeLine &&
    name &&
    name.toLowerCase() !== codeLine.toLowerCase() &&
    !name.toLowerCase().startsWith(`${codeLine.toLowerCase()} `)
  ) {
    return { primary: codeLine, secondary: name };
  }
  return { primary: name || codeLine || "—", secondary: "" };
}

function paymentColor(
  colors: ReturnType<typeof useTheme>["colors"],
  status?: string | null,
): string {
  switch (status) {
    case "paid":
      return colors.success;
    case "partial":
      return colors.warning;
    default:
      return colors.danger;
  }
}

type SummaryTone = "brand" | "accent" | "warning" | "success" | "danger";

function summaryToneColor(
  colors: ReturnType<typeof useTheme>["colors"],
  tone?: SummaryTone,
): string {
  switch (tone) {
    case "brand":
      return colors.brand;
    case "accent":
      return colors.accent;
    case "warning":
      return colors.warning;
    case "success":
      return colors.success;
    case "danger":
      return colors.danger;
    default:
      return colors.ink;
  }
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
      className="rounded-full px-3.5 py-1.5"
      style={{
        backgroundColor: active ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.lineStrong,
      }}
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
  tone?: SummaryTone;
}) {
  const { colors } = useTheme();
  return (
    <View className="mb-2 min-w-[48%] flex-1 p-3" style={cardChrome(colors)}>
      <Text className="text-[10px]" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="mt-0.5 text-sm font-semibold"
        style={{ color: summaryToneColor(colors, tone) }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function DetailItem({
  label,
  children,
  tone,
}: {
  label: string;
  children: ReactNode;
  tone?: string;
}) {
  const { colors } = useTheme();
  return (
    <View className="min-w-[45%] flex-1">
      <Text className="text-[10px]" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="mt-0.5 text-xs font-semibold"
        style={{ color: tone ?? colors.ink }}
        numberOfLines={2}
      >
        {children}
      </Text>
    </View>
  );
}

function ReportField({
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

function OrderStatusBadge({ status }: { status?: string | null }) {
  const { colors } = useTheme();
  const normalized = normalizeOrderStatus(status);
  return (
    <View
      className="rounded-full px-2 py-0.5"
      style={{ backgroundColor: orderStatusSoft(colors, normalized) }}
    >
      <Text
        className="text-[10px] font-medium"
        style={{ color: orderStatusColor(colors, normalized) }}
      >
        {ORDER_STATUS_LABELS[normalized] ?? status ?? "—"}
      </Text>
    </View>
  );
}

function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      className="min-w-[140px] flex-1 flex-row items-center gap-2 rounded-xl px-3"
      style={{ ...inputChrome(colors), height: 40, minHeight: 0 }}
    >
      <Ionicons name="search" size={16} color={colors.inkFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        className="flex-1 text-sm"
        style={{ color: colors.ink }}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

function MonthPickerButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const parsed = parseMonthValue(value);
  const pickerDate = parsed
    ? new Date(parsed.year, parsed.month - 1, 1)
    : new Date();

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.lineStrong,
        }}
        accessibilityRole="button"
        accessibilityLabel={`Месяц: ${monthLabel(value)}`}
      >
        <Ionicons name="calendar-outline" size={15} color={colors.inkMuted} />
        <Text className="text-xs font-medium" style={{ color: colors.inkSoft }}>
          {monthLabel(value)}
        </Text>
      </Pressable>
      <NativeDatePicker
        visible={open}
        value={pickerDate}
        onChange={(date) => {
          const next = toIsoDate(date).slice(0, 7);
          onChange(isMonthValue(next) ? next : currentMonthValue());
        }}
        onClose={() => setOpen(false)}
      />
    </>
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
      className="flex-row items-center gap-1 rounded-full px-3.5 py-1.5"
      style={{
        backgroundColor: open ? colors.brandSoft : colors.surface,
        borderWidth: 1,
        borderColor: open ? colors.brand : colors.lineStrong,
      }}
      accessibilityRole="button"
      accessibilityLabel="Фильтры"
      accessibilityState={{ expanded: open }}
    >
      <Ionicons
        name={open ? "chevron-up" : "options-outline"}
        size={15}
        color={open ? colors.brand : colors.inkMuted}
      />
      <Text
        className="text-xs font-medium"
        style={{ color: open ? colors.brand : colors.inkSoft }}
      >
        Фильтры
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
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.lineStrong,
      }}
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

function EmptyReport({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View className="items-center px-4 py-8" style={cardChrome(colors)}>
      <Ionicons
        name="document-text-outline"
        size={28}
        color={colors.inkFaint}
      />
      <Text className="mt-2 text-sm" style={{ color: colors.inkMuted }}>
        {text}
      </Text>
    </View>
  );
}

function EconomicsOrderCard({
  order,
  expanded,
  onToggle,
  onOpenOrder,
}: {
  order: OrderEconomicsRow;
  expanded: boolean;
  onToggle: () => void;
  onOpenOrder: (orderId: number) => void;
}) {
  const { colors } = useTheme();
  const remaining = Number(order.remaining_amount) || 0;
  return (
    <Pressable
      onPress={onToggle}
      className="mb-2 rounded-xl p-3"
      style={cardChrome(colors)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={14}
              color={colors.inkMuted}
            />
            <Pressable onPress={() => onOpenOrder(order.order_id)}>
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.brand }}
              >
                №{order.order_number}
              </Text>
            </Pressable>
            <OrderStatusBadge status={order.status} />
            {order.is_preliminary ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: colors.warningSoft }}
              >
                <Text
                  className="text-[10px] font-medium"
                  style={{ color: colors.warning }}
                >
                  Предварительный расчёт
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            className="mt-1.5 text-sm"
            style={{ color: colors.ink }}
            numberOfLines={2}
          >
            {order.client_name || "—"}
            <Text style={{ color: colors.inkMuted }}>
              {" "}
              · {vehicleLabel(order.vehicle)}
            </Text>
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: colors.inkMuted }}>
            {order.scheduled_at
              ? formatWallClockDateTime(order.scheduled_at)
              : "—"}
          </Text>
        </View>
        <View className="items-end">
          <Text
            className="text-base font-semibold"
            style={{ color: colors.ink }}
          >
            {formatMoney(order.grand_total)}
          </Text>
          <Text
            className="mt-0.5 text-[10px] font-medium"
            style={{ color: paymentColor(colors, order.payment_status) }}
          >
            {PAYMENT_STATUS_LABELS[order.payment_status] ??
              order.payment_status}
            {remaining > 0 ? ` · ${formatMoney(order.remaining_amount)}` : ""}
          </Text>
        </View>
      </View>
      <View className="mt-2 flex-row justify-between">
        <Text className="text-[10px]" style={{ color: colors.inkMuted }}>
          ЗЧ {formatMoney(order.parts_cost)} · ФОТ{" "}
          {formatMoney(order.payroll_total)}
        </Text>
        <Text
          className="text-[10px] font-medium"
          style={{
            color:
              Number(order.net_profit) >= 0 ? colors.success : colors.danger,
          }}
        >
          прибыль {formatMoney(order.net_profit)}
        </Text>
      </View>
      {expanded ? (
        <View
          className="mt-3 flex-row flex-wrap gap-x-3 gap-y-2 border-t pt-3"
          style={{ borderTopColor: colors.line }}
        >
          <DetailItem label="Телефон">{order.client_phone || "—"}</DetailItem>
          <DetailItem label="Оплата">
            {PAYMENT_STATUS_LABELS[order.payment_status] ??
              order.payment_status}
          </DetailItem>
          <DetailItem label="Оплачено">
            {formatMoney(order.paid_amount)}
          </DetailItem>
          <DetailItem label="Сумма заказа">
            {formatMoney(order.grand_total)}
          </DetailItem>
          <DetailItem label="Себестоимость ЗЧ">
            {formatMoney(order.parts_cost)}
          </DetailItem>
          <DetailItem label="Зарплата мастеру">
            {formatMoney(order.payroll_total)}
          </DetailItem>
          <DetailItem
            label="Чистая прибыль"
            tone={
              Number(order.net_profit) >= 0 ? colors.success : colors.danger
            }
          >
            {formatMoney(order.net_profit)}
          </DetailItem>
          <DetailItem
            label="Дебит"
            tone={remaining > 0 ? colors.danger : undefined}
          >
            {formatMoney(order.remaining_amount)}
          </DetailItem>
          <DetailItem label="Работ">{order.works_count}</DetailItem>
          <DetailItem label="Поз. ЗЧ">{order.shop_parts_count}</DetailItem>
          <DetailItem label="Расчёт">
            {order.is_preliminary ? "Предварительный" : "Фактический"}
          </DetailItem>
          <DetailItem label="Статус">
            {orderStatusLabel(order.status)}
          </DetailItem>
        </View>
      ) : null}
    </Pressable>
  );
}

function StockItemCard({
  item,
  isCurrentMonth,
  expanded,
  onToggle,
}: {
  item: WarehouseStockRow;
  isCurrentMonth: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const { primary, secondary } = warehouseStockNameParts(item);
  const unit = UNIT_LABELS[item.unit] ?? item.unit;
  return (
    <Pressable
      onPress={onToggle}
      className="mb-2 rounded-xl p-3"
      style={cardChrome(colors)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={14}
              color={colors.inkMuted}
            />
            <Text
              className="flex-1 text-sm font-semibold"
              style={{ color: colors.ink }}
              numberOfLines={2}
            >
              {primary}
            </Text>
          </View>
          {secondary ? (
            <Text
              className="mt-0.5 text-xs"
              style={{ color: colors.inkMuted }}
              numberOfLines={2}
            >
              {secondary}
            </Text>
          ) : null}
          <Text className="mt-1 text-xs" style={{ color: colors.inkMuted }}>
            остаток {item.closing_qty} {unit}
            {item.available_qty != null
              ? ` · доступно ${item.available_qty}`
              : ""}
          </Text>
        </View>
        <Text className="text-base font-semibold" style={{ color: colors.ink }}>
          {formatMoney(item.stock_amount)}
        </Text>
      </View>
      {expanded ? (
        <View
          className="mt-3 flex-row flex-wrap gap-x-3 gap-y-2 border-t pt-3"
          style={{ borderTopColor: colors.line }}
        >
          <DetailItem label="Цена">{formatMoney(item.unit_price)}</DetailItem>
          <DetailItem label="Остаток">
            {item.closing_qty} {unit}
          </DetailItem>
          <DetailItem label="Сумма">
            {formatMoney(item.stock_amount)}
          </DetailItem>
          <DetailItem label="Приход">{item.received_qty}</DetailItem>
          <DetailItem label="Расход">{item.expensed_qty}</DetailItem>
          {isCurrentMonth ? (
            <>
              <DetailItem label="Резерв">{item.reserved_qty ?? "—"}</DetailItem>
              <DetailItem label="Доступно">
                {item.available_qty ?? "—"}
              </DetailItem>
            </>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function PayrollEmployeeCard({
  employee,
  expanded,
  onToggle,
  onOpenOrder,
}: {
  employee: PayrollEmployeeRow;
  expanded: boolean;
  onToggle: () => void;
  onOpenOrder: (orderId: number) => void;
}) {
  const { colors } = useTheme();
  const orders = employee.orders ?? [];
  return (
    <View
      className="mb-2 rounded-xl p-3"
      style={cardChrome(colors)}
    >
      <Pressable onPress={onToggle} accessibilityRole="button">
        <View className="flex-row items-start gap-2">
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={14}
            color={colors.inkMuted}
            style={{ marginTop: 2 }}
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text
                className="flex-1 text-sm font-semibold"
                style={{ color: colors.ink }}
                numberOfLines={1}
              >
                {employee.name}
              </Text>
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.ink }}
              >
                {formatMoney(employee.total)}
              </Text>
            </View>
            <Text className="mt-1 text-xs" style={{ color: colors.inkMuted }}>
              {employee.completed_orders}{" "}
              {plural(
                employee.completed_orders,
                "заказ-наряд",
                "заказ-наряда",
                "заказ-нарядов",
              )}
            </Text>
            <Text className="mt-0.5 text-xs" style={{ color: colors.inkMuted }}>
              выдано {formatMoney(employee.paid)} · остаток{" "}
              {formatMoney(employee.remaining)}
            </Text>
          </View>
        </View>
      </Pressable>
      {expanded ? (
        <View
          className="mt-3 gap-2 border-t pt-3"
          style={{ borderTopColor: colors.line }}
        >
          {orders.length === 0 ? (
            <Text className="text-xs" style={{ color: colors.inkMuted }}>
              Нет начислений по заказ-нарядам
            </Text>
          ) : (
            orders.map((order) => (
              <Pressable
                key={order.order_id}
                onPress={() => onOpenOrder(order.order_id)}
                className="rounded-lg p-2.5"
                style={{ backgroundColor: colors.surface }}
                accessibilityRole="button"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    className="flex-1 text-sm font-medium"
                    style={{ color: colors.brand }}
                    numberOfLines={1}
                  >
                    ЗН №{order.order_number}
                  </Text>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.ink }}
                  >
                    {formatMoney(order.amount)}
                  </Text>
                </View>
                <Text
                  className="mt-0.5 text-xs"
                  style={{ color: colors.inkMuted }}
                >
                  {vehicleLabel(order.vehicle)} ·{" "}
                  {order.end_at ? formatServerDate(order.end_at) : "—"}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const EMPTY_ECONOMICS_SUMMARY = {
  count: 0,
  revenue: 0,
  parts_cost: 0,
  payroll_total: 0,
  net_profit: 0,
  paid_amount: 0,
  debt_amount: 0,
  unpaid_count: 0,
};

const EMPTY_STOCK_SUMMARY = {
  positions: 0,
  closing_value: 0,
  opening_value: 0,
  received_qty: 0,
  expensed_qty: 0,
};

export function ReportsScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const { user } = useSession();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const canPayroll = Boolean(user?.isDirector);
  const tabs = useMemo<{ id: Tab; label: string }[]>(
    () => [
      { id: "economics", label: "Экономика" },
      { id: "stock", label: "Остатки" },
      ...(canPayroll ? [{ id: "payroll" as Tab, label: "Зарплата" }] : []),
    ],
    [canPayroll],
  );

  const [tab, setTabState] = useState<Tab>("economics");

  const econDefaults = useMemo(() => defaultEconomicsFilters(), []);
  const [econFiltersStored, setEconFiltersStored] =
    usePersistedState<EconomicsFilters>(
      pageFiltersKey("reports:economics"),
      econDefaults,
    );
  const econFilters = useMemo(
    () => sanitizeEconomicsFilters(econFiltersStored),
    [econFiltersStored],
  );
  const updateEconFilters = useCallback(
    (patch: Partial<EconomicsFilters>) => {
      setEconFiltersStored((prev) => ({
        ...sanitizeEconomicsFilters(prev),
        ...patch,
      }));
    },
    [setEconFiltersStored],
  );

  const [monthValueStored, setMonthValueStored] = usePersistedState<string>(
    pageFiltersKey("reports:month"),
    currentMonthValue(),
  );
  const monthValue = isMonthValue(monthValueStored)
    ? monthValueStored
    : currentMonthValue();
  const setMonthValue = useCallback(
    (value: string) => {
      setMonthValueStored(isMonthValue(value) ? value : currentMonthValue());
    },
    [setMonthValueStored],
  );
  const monthParts = useMemo(() => parseMonthValue(monthValue), [monthValue]);

  const [hideZeroStored, setHideZeroStored] = usePersistedState<boolean>(
    pageFiltersKey("reports:stock-hide-zero"),
    true,
  );
  const hideZero = hideZeroStored !== false;

  const [econSearchInput, setEconSearchInput] = useState("");
  const [econSearch, setEconSearch] = useState("");
  const [stockSearchInput, setStockSearchInput] = useState("");
  const [stockSearch, setStockSearch] = useState("");

  const [econ, setEcon] = useState<OrderEconomicsResponse | null>(null);
  const [stock, setStock] = useState<WarehouseStockResponse | null>(null);
  const [payroll, setPayroll] = useState<PayrollReportResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [expandedStockId, setExpandedStockId] = useState<number | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(
    null,
  );

  const selectTab = useCallback((next: Tab) => {
    setTabState(next);
    setFiltersOpen(false);
    setExpandedOrderId(null);
    setExpandedStockId(null);
    setExpandedEmployeeId(null);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setEconSearch(econSearchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [econSearchInput]);

  useEffect(() => {
    const timer = setTimeout(
      () => setStockSearch(stockSearchInput.trim()),
      300,
    );
    return () => clearTimeout(timer);
  }, [stockSearchInput]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setStaleAt(null);
      try {
        if (tab === "economics") {
          const result = await fetchOrderEconomics({
            dateFrom: econFilters.dateFrom,
            dateTo: econFilters.dateTo,
            status: econFilters.status,
            payment: econFilters.payment,
            q: econSearch || undefined,
          });
          setEcon(result.data);
          setStaleAt(result.stale ? result.fetchedAt : null);
        } else if (tab === "stock") {
          if (!monthParts) return;
          const result = await fetchWarehouseStock({
            year: monthParts.year,
            month: monthParts.month,
            q: stockSearch || undefined,
            hideZero,
          });
          setStock(result.data);
          setStaleAt(result.stale ? result.fetchedAt : null);
        } else if (tab === "payroll") {
          if (!monthParts || !canPayroll) return;
          const result = await fetchPayrollReport(
            monthParts.year,
            monthParts.month,
          );
          setPayroll(result.data);
          setStaleAt(result.stale ? result.fetchedAt : null);
        }
      } catch (error) {
        show(describeError(error), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      tab,
      econFilters,
      econSearch,
      monthParts,
      stockSearch,
      hideZero,
      canPayroll,
      show,
    ],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const exportReport = useCallback(async () => {
    if (xlsxBusy) return;
    setXlsxBusy(true);
    try {
      if (tab === "economics") {
        await shareReportXlsx(
          orderEconomicsPath(
            {
              dateFrom: econFilters.dateFrom,
              dateTo: econFilters.dateTo,
              status: econFilters.status,
              payment: econFilters.payment,
              q: econSearch || undefined,
            },
            true,
          ),
          `order_economics_${econFilters.dateFrom}_${econFilters.dateTo}.xlsx`,
        );
      } else if (tab === "stock") {
        if (!monthParts) return;
        await shareReportXlsx(
          warehouseStockPath(
            {
              year: monthParts.year,
              month: monthParts.month,
              q: stockSearch || undefined,
              hideZero,
            },
            true,
          ),
          `warehouse_stock_${monthValue.replace("-", "_")}.xlsx`,
        );
      } else if (tab === "payroll") {
        if (!monthParts) return;
        await shareReportXlsx(
          payrollPath(monthParts.year, monthParts.month, true),
          `payroll_${monthValue.replace("-", "_")}.xlsx`,
        );
      }
    } catch (error) {
      show(describeError(error), "error");
    } finally {
      setXlsxBusy(false);
    }
  }, [
    xlsxBusy,
    tab,
    econFilters,
    econSearch,
    monthParts,
    monthValue,
    stockSearch,
    hideZero,
    show,
  ]);

  const openOrder = useCallback(
    (orderId: number) => {
      navigation.navigate("OrderDetail", { id: orderId });
    },
    [navigation],
  );

  const todayDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(todayDate), [todayDate]);
  const dateFromMaxDate =
    econFilters.dateTo < todayIso
      ? (isoToLocalDate(econFilters.dateTo) ?? todayDate)
      : todayDate;
  const dateToMinDate = isoToLocalDate(econFilters.dateFrom) ?? todayDate;

  const econFilterCount =
    (econFilters.status !== "all" ? 1 : 0) +
    (econFilters.payment !== "all" ? 1 : 0) +
    (econFilters.dateFrom !== econDefaults.dateFrom ||
    econFilters.dateTo !== econDefaults.dateTo
      ? 1
      : 0);
  const activeFilterCount =
    tab === "economics"
      ? econFilterCount
      : tab === "stock" && !hideZero
        ? 1
        : 0;

  const econSummary = econ?.summary ?? EMPTY_ECONOMICS_SUMMARY;
  const econItems = econ?.items ?? [];
  const stockSummary = stock?.summary ?? EMPTY_STOCK_SUMMARY;
  const stockItems = stock?.items ?? [];
  const payrollEmployees = payroll?.employees ?? [];

  const resetEconomicsFilters = useCallback(() => {
    updateEconFilters({
      dateFrom: econDefaults.dateFrom,
      dateTo: econDefaults.dateTo,
      status: "all",
      payment: "all",
    });
  }, [econDefaults, updateEconFilters]);

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <AppHeader title="Отчёты" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
      >
        {tabs.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={tab === item.id}
            onPress={() => selectTab(item.id)}
          />
        ))}
      </ScrollView>

      {tab === "payroll" ? (
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <MonthPickerButton value={monthValue} onChange={setMonthValue} />
          <View className="flex-1" />
          <ExportButton
            busy={xlsxBusy}
            disabled={loading}
            onPress={() => void exportReport()}
          />
        </View>
      ) : (
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <SearchField
            value={tab === "economics" ? econSearchInput : stockSearchInput}
            onChangeText={
              tab === "economics" ? setEconSearchInput : setStockSearchInput
            }
            placeholder={
              tab === "economics"
                ? "Номер, клиент, авто, VIN, госномер"
                : "Бренд, артикул, наименование"
            }
          />
          {tab === "stock" ? (
            <MonthPickerButton value={monthValue} onChange={setMonthValue} />
          ) : null}
          <FilterButton
            open={filtersOpen}
            count={activeFilterCount}
            onPress={() => setFiltersOpen((prev) => !prev)}
          />
          <ExportButton
            busy={xlsxBusy}
            disabled={loading}
            onPress={() => void exportReport()}
          />
        </View>
      )}

      {filtersOpen && tab === "economics" ? (
        <View
          className="mb-3 gap-3 rounded-xl p-3"
          style={cardChrome(colors)}
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
                value={econFilters.dateFrom}
                onChange={(value) => {
                  updateEconFilters({
                    dateFrom: value,
                    dateTo:
                      value > econFilters.dateTo ? value : econFilters.dateTo,
                  });
                }}
                maximumDate={dateFromMaxDate}
              />
            </View>
            <View className="flex-1">
              <DatePickerField
                label="По"
                value={econFilters.dateTo}
                onChange={(value) => {
                  updateEconFilters({
                    dateTo: value,
                    dateFrom:
                      value < econFilters.dateFrom
                        ? value
                        : econFilters.dateFrom,
                  });
                }}
                minimumDate={dateToMinDate}
                maximumDate={todayDate}
              />
            </View>
          </View>
          <View>
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{ color: colors.inkMuted }}
            >
              Статус
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ECONOMICS_STATUS_OPTIONS.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  active={econFilters.status === item.id}
                  onPress={() => updateEconFilters({ status: item.id })}
                />
              ))}
            </View>
          </View>
          <View>
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{ color: colors.inkMuted }}
            >
              Оплата
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ECONOMICS_PAYMENT_OPTIONS.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  active={econFilters.payment === item.id}
                  onPress={() => updateEconFilters({ payment: item.id })}
                />
              ))}
            </View>
          </View>
          <Pressable onPress={resetEconomicsFilters} hitSlop={8}>
            <Text
              className="text-xs font-medium"
              style={{ color: colors.brand }}
            >
              Сбросить фильтры
            </Text>
          </Pressable>
        </View>
      ) : null}

      {filtersOpen && tab === "stock" ? (
        <View
          className="mb-3 flex-row items-center justify-between rounded-xl p-3"
          style={cardChrome(colors)}
        >
          <Text className="text-sm" style={{ color: colors.inkSoft }}>
            Скрыть нулевые остатки
          </Text>
          <Switch
            value={hideZero}
            onValueChange={(value) => setHideZeroStored(value)}
            trackColor={{ false: colors.lineStrong, true: colors.brand }}
            thumbColor="#fff"
          />
        </View>
      ) : null}

      {staleAt != null ? (
        <View className="mb-2">
          <StaleDataBadge fetchedAt={staleAt} />
        </View>
      ) : null}

      {loading ? (
        <SkeletonRows count={6} />
      ) : tab === "economics" ? (
        econ ? (
          <>
            <Text className="mb-2 text-xs" style={{ color: colors.inkMuted }}>
              {econSummary.count}{" "}
              {plural(
                econSummary.count,
                "заказ-наряд",
                "заказ-наряда",
                "заказ-нарядов",
              )}{" "}
              за период
              {econSummary.unpaid_count > 0
                ? ` · не оплачено: ${econSummary.unpaid_count}`
                : ""}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <SummaryTile
                label="Выручка"
                value={formatMoney(econSummary.revenue)}
                tone="brand"
              />
              <SummaryTile
                label="Себестоимость"
                value={formatMoney(econSummary.parts_cost)}
                tone="accent"
              />
              <SummaryTile
                label="Зарплата"
                value={formatMoney(econSummary.payroll_total)}
                tone="warning"
              />
              <SummaryTile
                label="Чистая прибыль"
                value={formatMoney(econSummary.net_profit)}
                tone={
                  Number(econSummary.net_profit) >= 0 ? "success" : "danger"
                }
              />
              <SummaryTile
                label="Дебит"
                value={formatMoney(econSummary.debt_amount)}
                tone={
                  Number(econSummary.debt_amount) > 0 ? "danger" : undefined
                }
              />
            </View>
            {econItems.length === 0 ? (
              <EmptyReport text="За выбранный период и фильтры заказ-нарядов не найдено." />
            ) : (
              econItems.map((order) => (
                <EconomicsOrderCard
                  key={order.order_id}
                  order={order}
                  expanded={expandedOrderId === order.order_id}
                  onToggle={() =>
                    setExpandedOrderId((prev) =>
                      prev === order.order_id ? null : order.order_id,
                    )
                  }
                  onOpenOrder={openOrder}
                />
              ))
            )}
          </>
        ) : (
          <EmptyReport text="Не удалось загрузить отчёт." />
        )
      ) : tab === "stock" ? (
        stock ? (
          <>
            <Text className="mb-2 text-xs" style={{ color: colors.inkMuted }}>
              {stockItems.length}{" "}
              {plural(stockItems.length, "позиция", "позиции", "позиций")}
              {stock.as_of ? ` · на ${formatServerDate(stock.as_of)}` : ""}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <SummaryTile
                label="Позиций с остатком"
                value={String(stockSummary.positions)}
              />
              <SummaryTile
                label="Сумма на конец"
                value={formatMoney(stockSummary.closing_value)}
                tone="brand"
              />
              <SummaryTile
                label="Сумма на начало"
                value={formatMoney(stockSummary.opening_value)}
              />
              <SummaryTile
                label="Приход / Расход"
                value={`${stockSummary.received_qty} / ${stockSummary.expensed_qty}`}
              />
            </View>
            {stockItems.length === 0 ? (
              <EmptyReport text="За выбранный месяц позиций с остатком не найдено." />
            ) : (
              stockItems.map((item) => (
                <StockItemCard
                  key={item.id}
                  item={item}
                  isCurrentMonth={Boolean(stock.is_current_month)}
                  expanded={expandedStockId === item.id}
                  onToggle={() =>
                    setExpandedStockId((prev) =>
                      prev === item.id ? null : item.id,
                    )
                  }
                />
              ))
            )}
            {!stock.is_current_month ? (
              <Text className="mt-1 text-xs" style={{ color: colors.inkMuted }}>
                Для прошлых месяцев резерв и доступно не рассчитываются —
                показан фактический остаток на последний день месяца.
              </Text>
            ) : null}
          </>
        ) : (
          <EmptyReport text="Не удалось загрузить остатки." />
        )
      ) : payroll ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <SummaryTile
              label="Начислено"
              value={formatMoney(payroll.total)}
              tone="brand"
            />
            <SummaryTile
              label="Выдано"
              value={formatMoney(payroll.total_paid)}
              tone="success"
            />
            <SummaryTile
              label="Остаток"
              value={formatMoney(payroll.total_remaining)}
              tone={Number(payroll.total_remaining) > 0 ? "warning" : undefined}
            />
          </View>
          {payrollEmployees.length === 0 ? (
            <EmptyReport text="За этот месяц начислений по заказ-нарядам нет." />
          ) : (
            <>
              {payrollEmployees.map((employee) => (
                <PayrollEmployeeCard
                  key={employee.employee_id}
                  employee={employee}
                  expanded={expandedEmployeeId === employee.employee_id}
                  onToggle={() =>
                    setExpandedEmployeeId((prev) =>
                      prev === employee.employee_id
                        ? null
                        : employee.employee_id,
                    )
                  }
                  onOpenOrder={openOrder}
                />
              ))}
              <View
                className="mt-1 rounded-xl p-3"
                style={cardChrome(colors)}
              >
                <ReportField label="Сумма">
                  {formatMoney(payroll.total)}
                </ReportField>
                <View className="mt-1.5" />
                <ReportField label="Выдано">
                  {formatMoney(payroll.total_paid)}
                </ReportField>
                <View className="mt-1.5" />
                <ReportField label="Остаток">
                  {formatMoney(payroll.total_remaining)}
                </ReportField>
              </View>
            </>
          )}
        </>
      ) : (
        <EmptyReport text="Не удалось загрузить зарплаты." />
      )}
    </Screen>
  );
}
