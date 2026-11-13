import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

import {
  fetchOrder,
  fetchOrderPayments,
  ORDER_STATUS_ACTIONS,
  orderPaymentStatus,
  PAYMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  patchOrderStatus,
  shareOrderPdf,
  type OrderDetail,
  type OrderPayment,
} from "../api/orders";
import { createOrderPayment } from "../api/finance";
import { PERM, hasPermission } from "../auth/access";
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
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
  toIsoDate,
} from "../utils/format";
import { orderStatusColor, orderStatusSoft } from "../utils/orderStatusColors";

type Props = NativeStackScreenProps<RootStackParamList, "OrderDetail">;

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = formatDayMonth(value);
  const t = formatTime(value);
  return t ? `${d} ${t}` : d || "—";
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View className="flex-row items-start justify-between gap-3 py-1">
      <Text className="text-xs" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="flex-1 text-right text-sm"
        style={{
          color: highlight ? colors.success : colors.ink,
          fontWeight: highlight ? "600" : "400",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      className="mb-3 rounded-xl p-3"
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <Text
        className="mb-2 text-xs font-semibold uppercase"
        style={{ color: colors.inkMuted }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function MoneyLine({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "success" | "danger" | "muted";
}) {
  const { colors } = useTheme();
  const color =
    tone === "success"
      ? colors.success
      : tone === "danger"
        ? colors.danger
        : tone === "muted"
          ? colors.inkMuted
          : colors.ink;
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className="text-sm" style={{ color: colors.inkMuted }}>
        {label}
      </Text>
      <Text
        className="text-sm tabular-nums"
        style={{
          color,
          fontWeight: bold ? "700" : "500",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function OrderDetailScreen({ route }: Props) {
  const { colors } = useTheme();
  const { user } = useSession();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { id } = route.params;
  const codes = currentPermissionCodes();
  const canFullOrders = hasPermission(user, codes, PERM.orders);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionSheet, setActionSheet] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    status: string;
    label: string;
  } | null>(null);
  const [paySheet, setPaySheet] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "bank">("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => toIsoDate(new Date()));
  const [payBusy, setPayBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchOrder(id);
      setOrder(result.data);
      setStaleAt(result.fromCache ? result.fetchedAt : null);
      setError("");
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- загрузка карточки по id
    void load();
  }, [load]);

  useEffect(() => {
    if (!canFullOrders) return;
    fetchOrderPayments(id)
      .then(setPayments)
      .catch(() => setPayments([]));
  }, [id, canFullOrders]);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setBusy(null);
      setActionSheet(false);
      setPendingAction(null);
    }
  };

  const changeStatus = (status: string, label: string) =>
    runAction(`status-${status}`, async () => {
      await patchOrderStatus(id, status);
      show(`Статус: ${label.toLowerCase()}`, "success");
    });

  const openPdf = () =>
    runAction("pdf", async () => {
      await shareOrderPdf(id);
    });

  const callClient = () => {
    const phone = order?.client?.phone?.replace(/[^\d+]/g, "");
    if (phone) void Linking.openURL(`tel:${phone}`);
  };

  const openPaySheet = () => {
    setPayAmount(
      order?.remaining_amount != null
        ? String(Number(order.remaining_amount))
        : "",
    );
    setPayMethod("cash");
    setPayDate(toIsoDate(new Date()));
    setPaySheet(true);
  };

  const submitPayment = async () => {
    const amount = Number(String(payAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      show("Укажите сумму оплаты", "error");
      return;
    }
    setPayBusy(true);
    try {
      await createOrderPayment(id, {
        method: payMethod,
        amount,
        paid_at: payDate || undefined,
      });
      show("Оплата добавлена", "success");
      setPaySheet(false);
      await load();
      fetchOrderPayments(id)
        .then(setPayments)
        .catch(() => {});
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setPayBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <SkeletonRows count={6} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen className="items-center justify-center">
        <Text className="text-sm" style={{ color: colors.inkMuted }}>
          {error || "Заказ-наряд не найден"}
        </Text>
      </Screen>
    );
  }

  const normalized = normalizeOrderStatus(order.status);
  const closed = normalized === "completed" || normalized === "cancelled";
  const allowedActions = canFullOrders
    ? ORDER_STATUS_ACTIONS.filter((a) => {
        if (closed) return false;
        if (normalized === "review") return a.value === "cancelled";
        return a.value !== normalized;
      })
    : [];

  const vehicleLabel = order.vehicle
    ? [
        [order.vehicle.make, order.vehicle.model].filter(Boolean).join(" "),
        order.vehicle.plate,
      ]
        .filter(Boolean)
        .join(" · ")
    : "—";

  const payment = orderPaymentStatus(order);
  const inspectionHighlight = Boolean(order.inspection_scheduled_at) && !closed;

  return (
    <Screen>
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl font-bold" style={{ color: colors.ink }}>
              {order.order_number ? `№${order.order_number}` : `#${order.id}`}
            </Text>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: orderStatusSoft(colors, order.status) }}
            >
              <Text
                className="text-[10px] font-medium"
                style={{ color: orderStatusColor(colors, order.status) }}
              >
                {ORDER_STATUS_LABELS[normalized] ?? order.status}
              </Text>
            </View>
            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text
                className="text-[10px] font-medium"
                style={{ color: paymentColorStatic(colors, payment) }}
              >
                {PAYMENT_LABELS[payment]}
              </Text>
            </View>
          </View>
          <Text className="mt-0.5 text-sm" style={{ color: colors.inkMuted }}>
            {order.client?.name ?? "—"}
          </Text>
        </View>
        {staleAt ? <StaleDataBadge fetchedAt={staleAt} /> : null}
      </View>

      <View className="mb-3 flex-row gap-2">
        {order.client?.phone ? (
          <Pressable
            onPress={callClient}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            <Ionicons name="call-outline" size={16} color={colors.brand} />
            <Text
              className="text-sm font-medium"
              style={{ color: colors.brand }}
            >
              Позвонить
            </Text>
          </Pressable>
        ) : null}
        {!closed ? (
          <Pressable
            onPress={() =>
              navigation.navigate("OrderForm", { orderId: order.id })
            }
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            <Ionicons name="create-outline" size={16} color={colors.inkSoft} />
            <Text
              className="text-sm font-medium"
              style={{ color: colors.inkSoft }}
            >
              Изменить
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void openPdf()}
          disabled={busy === "pdf"}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Ionicons
            name={busy === "pdf" ? "hourglass-outline" : "document-outline"}
            size={16}
            color={colors.inkSoft}
          />
          <Text
            className="text-sm font-medium"
            style={{ color: colors.inkSoft }}
          >
            {busy === "pdf" ? "PDF…" : "PDF"}
          </Text>
        </Pressable>
        {allowedActions.length > 0 ? (
          <Pressable
            onPress={() => setActionSheet(true)}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
            style={{ backgroundColor: colors.brand }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
            <Text className="text-sm font-medium" style={{ color: "#fff" }}>
              Статус
            </Text>
          </Pressable>
        ) : null}
      </View>

      <SectionCard title="Детали">
        <InfoRow label="Клиент" value={order.client?.name} />
        <InfoRow label="Телефон" value={order.client?.phone} />
        <InfoRow label="Автомобиль" value={vehicleLabel} />
        <InfoRow
          label="Пробег, км"
          value={order.mileage_km != null ? String(order.mileage_km) : null}
        />
        <InfoRow label="Рабочая зона" value={order.work_zone?.name} />
        <InfoRow
          label="Дата начала"
          value={formatDateTime(order.scheduled_at)}
        />
        <InfoRow
          label="Дата конца"
          value={
            order.scheduled_end_at
              ? formatDateTime(order.scheduled_end_at)
              : null
          }
        />
        <InfoRow
          label="Дата записи на осмотр"
          value={
            order.inspection_scheduled_at
              ? formatDateTime(order.inspection_scheduled_at)
              : null
          }
          highlight={inspectionHighlight}
        />
        <InfoRow label="Принял" value={order.accepted_by?.name} />
        <InfoRow
          label="Исполнители"
          value={order.assignees?.map((a) => a.name).join(", ")}
        />
        <InfoRow label="Комментарий клиента" value={order.client_comment} />
        <InfoRow label="Комментарий сотрудника" value={order.staff_comment} />
      </SectionCard>

      {order.works.length > 0 ? (
        <SectionCard title={`Работы · ${formatMoney(order.works_total)}`}>
          {order.works.map((work) => (
            <View
              key={work.id}
              className="mb-2 rounded-lg p-2.5"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text
                  className="flex-1 text-sm font-medium"
                  style={{ color: colors.ink }}
                >
                  {work.title}
                </Text>
                <Text
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: colors.ink }}
                >
                  {formatMoney(work.line_sum)}
                </Text>
              </View>
              <Text
                className="mt-0.5 text-xs"
                style={{ color: colors.inkMuted }}
              >
                {work.qty} × {formatMoney(work.unit_price)}
                {work.executors.length > 0
                  ? ` · ${work.executors
                      .map(
                        (e) =>
                          `${e.employee?.name ?? "?"} ${Number(e.percent)}%`,
                      )
                      .join(", ")}`
                  : ""}
                {work.contractors.length > 0
                  ? ` · подрядчики: ${work.contractors
                      .map((c) => c.contractor?.name ?? "?")
                      .join(", ")}`
                  : ""}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {order.client_parts.length > 0 ? (
        <SectionCard title="Запчасти клиента">
          {order.client_parts.map((part) => (
            <View
              key={part.id}
              className="flex-row items-center justify-between py-1"
            >
              <Text className="flex-1 text-sm" style={{ color: colors.ink }}>
                {part.title}
              </Text>
              <Text className="text-sm" style={{ color: colors.inkMuted }}>
                {part.qty} {part.unit === "pcs" ? "шт" : part.unit}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {order.shop_parts.length > 0 ? (
        <SectionCard
          title={`Запчасти исполнителя · ${formatMoney(order.shop_parts_total)}`}
        >
          {order.shop_parts.map((part) => (
            <View
              key={part.id}
              className="flex-row items-center justify-between py-1"
            >
              <View className="flex-1">
                <Text className="text-sm" style={{ color: colors.ink }}>
                  {part.display_name || part.title}
                </Text>
                <Text className="text-xs" style={{ color: colors.inkMuted }}>
                  {Number(part.qty)} {part.unit === "pcs" ? "шт" : part.unit} ×{" "}
                  {formatMoney(part.price_with_markup ?? part.unit_price)}
                </Text>
              </View>
              <Text
                className="ml-2 text-sm font-medium tabular-nums"
                style={{ color: colors.ink }}
              >
                {formatMoney(part.line_sum)}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      {order.deliveries.length > 0 ? (
        <SectionCard
          title={`Доставки · ${formatMoney(order.deliveries_total)}`}
        >
          {order.deliveries.map((d) => (
            <View
              key={d.id}
              className="flex-row items-center justify-between py-1"
            >
              <Text className="flex-1 text-sm" style={{ color: colors.ink }}>
                {d.title}
              </Text>
              <Text className="text-sm" style={{ color: colors.inkMuted }}>
                {formatMoney(d.price)}
              </Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title="Итого">
        <MoneyLine
          label="Работы"
          value={formatMoney(order.works_total)}
          tone="muted"
        />
        <MoneyLine
          label="Запчасти"
          value={formatMoney(order.shop_parts_total)}
          tone="muted"
        />
        <MoneyLine
          label="Доставки"
          value={formatMoney(order.deliveries_total)}
          tone="muted"
        />
        {Number(order.discount_percent) > 0 ? (
          <MoneyLine
            label={`Скидка ${Number(order.discount_percent)}%`}
            value=""
            tone="muted"
          />
        ) : null}
        {Number(order.vat_rate) > 0 ? (
          <MoneyLine
            label={`НДС ${Number(order.vat_rate)}% включён`}
            value=""
            tone="muted"
          />
        ) : null}
        <View className="my-1 border-t" style={{ borderColor: colors.line }} />
        <MoneyLine
          label="К оплате"
          value={formatMoney(order.grand_total)}
          bold
        />
        <MoneyLine
          label="Оплачено"
          value={formatMoney(order.paid_amount)}
          tone="success"
        />
        <MoneyLine
          label="Остаток"
          value={formatMoney(order.remaining_amount)}
          bold
          tone={Number(order.remaining_amount) > 0 ? "danger" : "success"}
        />
      </SectionCard>

      {canFullOrders ? (
        <SectionCard title="Оплаты">
          {payments.length === 0 ? (
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              Оплат нет
            </Text>
          ) : (
            payments.map((p) => (
              <View
                key={p.id}
                className="flex-row items-center justify-between py-1"
              >
                <View className="flex-1">
                  <Text
                    className="text-sm"
                    style={{
                      color: p.is_cancelled ? colors.inkFaint : colors.ink,
                      textDecorationLine: p.is_cancelled
                        ? "line-through"
                        : "none",
                    }}
                  >
                    {PAYMENT_METHOD_LABELS[p.method] ?? p.method} · №
                    {p.sequential_number}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.inkMuted }}>
                    {formatDateTime(p.paid_at ?? p.created_at)}
                  </Text>
                </View>
                <Text
                  className="text-sm font-medium tabular-nums"
                  style={{
                    color: p.is_cancelled ? colors.inkFaint : colors.ink,
                  }}
                >
                  {formatMoney(p.amount)}
                </Text>
              </View>
            ))
          )}
          {!closed && Number(order.remaining_amount ?? 0) > 0 ? (
            <Pressable
              onPress={openPaySheet}
              className="mt-2 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5"
              style={{ backgroundColor: colors.brandSoft }}
            >
              <Ionicons name="add" size={16} color={colors.brand} />
              <Text
                className="text-sm font-medium"
                style={{ color: colors.brand }}
              >
                Добавить оплату · остаток {formatMoney(order.remaining_amount)}
              </Text>
            </Pressable>
          ) : null}
        </SectionCard>
      ) : null}

      <Sheet
        visible={actionSheet}
        title="Сменить статус"
        onClose={() => setActionSheet(false)}
      >
        <View className="gap-2">
          {allowedActions.map((a) => (
            <Pressable
              key={a.value}
              onPress={() =>
                setPendingAction({ status: a.value, label: a.label })
              }
              className="flex-row items-center gap-3 rounded-xl px-3 py-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Ionicons
                name={
                  a.value === "cancelled"
                    ? "close-circle-outline"
                    : a.value === "completed"
                      ? "checkmark-done-outline"
                      : "arrow-forward-circle-outline"
                }
                size={18}
                color={colors.inkSoft}
              />
              <Text className="text-base" style={{ color: colors.ink }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={pendingAction !== null}
        title={pendingAction?.label ?? ""}
        message={
          pendingAction?.status === "cancelled"
            ? "Заказ-наряд будет отменён, резервы и списания склада вернутся."
            : pendingAction?.status === "completed"
              ? "Заказ-наряд будет закрыт: начислится зарплата и спишутся складские позиции."
              : "Подтвердите смену статуса."
        }
        confirmLabel={pendingAction?.label ?? "Подтвердить"}
        destructive={pendingAction?.status === "cancelled"}
        onConfirm={() => {
          if (pendingAction) {
            void changeStatus(pendingAction.status, pendingAction.label);
          }
        }}
        onCancel={() => setPendingAction(null)}
      />

      <Sheet
        visible={paySheet}
        title="Новая оплата"
        onClose={() => setPaySheet(false)}
      >
        <View className="gap-3">
          <Text
            className="text-xs font-medium"
            style={{ color: colors.inkMuted }}
          >
            Способ оплаты
          </Text>
          <View className="flex-row gap-2">
            {(["cash", "card", "bank"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setPayMethod(m)}
                className="flex-1 items-center rounded-xl py-2.5"
                style={{
                  backgroundColor:
                    payMethod === m ? colors.brand : colors.surfaceSubtle,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: payMethod === m ? "#fff" : colors.inkSoft }}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View>
            <Text
              className="mb-1.5 text-xs font-medium"
              style={{ color: colors.inkMuted }}
            >
              Сумма
            </Text>
            <TextInput
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.inkFaint}
              className="rounded-xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.surfaceSubtle,
                color: colors.ink,
              }}
            />
          </View>
          <DateField
            label="Дата оплаты"
            value={payDate}
            onChangeText={setPayDate}
          />
          <Pressable
            onPress={() => void submitPayment()}
            disabled={payBusy}
            className="items-center rounded-xl py-3.5"
            style={{
              backgroundColor: colors.brand,
              opacity: payBusy ? 0.6 : 1,
            }}
          >
            <Text className="text-sm font-semibold text-white">
              {payBusy ? "Сохранение…" : "Добавить оплату"}
            </Text>
          </Pressable>
        </View>
      </Sheet>
    </Screen>
  );
}

function paymentColorStatic(
  colors: ReturnType<typeof useTheme>["colors"],
  payment: ReturnType<typeof orderPaymentStatus>,
): string {
  switch (payment) {
    case "paid":
      return colors.success;
    case "partial":
      return colors.warning;
    default:
      return colors.danger;
  }
}
