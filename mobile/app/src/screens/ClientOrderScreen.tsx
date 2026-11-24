import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  fetchMyRepairOrder,
  shareMyRepairOrderPdf,
  type ClientRepairOrder,
} from "../api/clientAccount";
import { describeError } from "../api/errors";
import {
  Button,
  Card,
  Screen,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import {
  clientOrderStatusLabel,
  formatDayMonth,
  formatMoney,
  formatTime,
  normalizeOrderStatus,
} from "../utils/format";
import { AppText as Text } from "../components/ui/AppText";

type Props = NativeStackScreenProps<RootStackParamList, "ClientOrder">;

function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide"
      style={{ color: colors.inkMuted }}
    >
      {children}
    </Text>
  );
}

function MoneyLine({
  label,
  value,
  strong,
}: {
  label: string;
  value?: number | string | null;
  strong?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row justify-between py-1">
      <Text
        className={strong ? "text-sm font-semibold" : "text-sm"}
        style={{ color: strong ? colors.ink : colors.inkSoft }}
      >
        {label}
      </Text>
      <Text
        className={strong ? "text-sm font-semibold" : "text-sm"}
        style={{ color: colors.ink }}
      >
        {formatMoney(value)}
      </Text>
    </View>
  );
}

function ItemRow({
  title,
  detail,
  right,
}: {
  title: string;
  detail?: string;
  right?: string;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-start justify-between py-1.5">
      <View className="min-w-0 flex-1">
        <Text
          className="text-sm"
          style={{ color: colors.ink }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {detail ? (
          <Text className="text-xs" style={{ color: colors.inkMuted }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right ? (
        <Text className="ml-3 text-sm" style={{ color: colors.inkSoft }}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

export function ClientOrderScreen({ route }: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const { orderId } = route.params;
  const [order, setOrder] = useState<ClientRepairOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchMyRepairOrder(orderId);
      setOrder(r.data ?? null);
      setStale(r.stale ? r.fetchedAt : null);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setLoading(false);
    }
  }, [orderId, show]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка
    void load();
  }, [load]);

  const openPdf = async () => {
    setPdfBusy(true);
    try {
      await shareMyRepairOrderPdf(orderId);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <SkeletonRows count={5} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Text
          className="pt-16 text-center text-base"
          style={{ color: colors.inkMuted }}
        >
          Заказ-наряд не найден
        </Text>
      </Screen>
    );
  }

  const vehicleLabelText = order.vehicle
    ? [order.vehicle.make, order.vehicle.model].filter(Boolean).join(" ")
    : "";
  const status = normalizeOrderStatus(order.status);
  const works = order.works ?? [];
  const clientParts = order.client_parts ?? [];
  const shopParts = order.shop_parts ?? [];
  const deliveries = order.deliveries ?? [];
  const discount = Number(order.discount_percent ?? 0);
  const scheduledDate = formatDayMonth(order.scheduled_at);
  const scheduledTime = formatTime(order.scheduled_at);
  const endDate = order.scheduled_end_at
    ? `${formatDayMonth(order.scheduled_end_at)} ${formatTime(order.scheduled_end_at)}`.trim()
    : "";

  return (
    <Screen>
      {stale != null ? <StaleDataBadge fetchedAt={stale} /> : null}

      <Card className="px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold" style={{ color: colors.ink }}>
            {order.order_number
              ? `Заказ-наряд №${order.order_number}`
              : "Заказ-наряд"}
          </Text>
          <View
            className="rounded-full px-2.5 py-1"
            style={{
              backgroundColor:
                status === "completed" || status === "done"
                  ? colors.success
                  : status === "cancelled"
                    ? colors.danger
                    : colors.brand,
              opacity: 0.15,
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{
                color:
                  status === "completed" || status === "done"
                    ? colors.success
                    : status === "cancelled"
                      ? colors.danger
                      : colors.brand,
              }}
            >
              {clientOrderStatusLabel(order.status)}
            </Text>
          </View>
        </View>
        <View className="mt-1 gap-0.5">
          {order.organization_name ? (
            <Text className="text-sm" style={{ color: colors.inkSoft }}>
              {order.organization_name}
            </Text>
          ) : null}
          {vehicleLabelText ? (
            <Text className="text-sm" style={{ color: colors.inkSoft }}>
              {vehicleLabelText}
              {order.vehicle?.plate ? ` · ${order.vehicle.plate}` : ""}
            </Text>
          ) : null}
          {scheduledDate ? (
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              {`Начало: ${scheduledDate}${scheduledTime ? ` ${scheduledTime}` : ""}`}
              {endDate ? ` · Конец: ${endDate}` : ""}
            </Text>
          ) : null}
          {order.work_zone?.name ? (
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              {`Пост: ${order.work_zone.name}`}
            </Text>
          ) : null}
        </View>
      </Card>

      {works.length > 0 ? (
        <>
          <SectionTitle>Работы</SectionTitle>
          <Card padded={false} className="px-4">
            {works.map((w) => (
              <ItemRow
                key={w.id}
                title={w.title}
                detail={w.qty > 1 ? `Кол-во: ${w.qty}` : undefined}
                right={formatMoney(w.line_sum)}
              />
            ))}
          </Card>
        </>
      ) : null}

      {clientParts.length > 0 ? (
        <>
          <SectionTitle>Клиентские запчасти</SectionTitle>
          <Card padded={false} className="px-4">
            {clientParts.map((p) => (
              <ItemRow
                key={p.id}
                title={p.title}
                detail={
                  Number(p.qty) > 1 ? `${p.qty} ${p.unit ?? "шт"}` : undefined
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      {shopParts.length > 0 ? (
        <>
          <SectionTitle>Запчасти магазина</SectionTitle>
          <Card padded={false} className="px-4">
            {shopParts.map((p) => (
              <ItemRow
                key={p.id}
                title={p.title || p.display_name || "Запчасть"}
                detail={
                  Number(p.qty) > 1 ? `${p.qty} ${p.unit ?? "шт"}` : undefined
                }
                right={formatMoney(p.line_sum)}
              />
            ))}
          </Card>
        </>
      ) : null}

      {deliveries.length > 0 ? (
        <>
          <SectionTitle>Доставки</SectionTitle>
          <Card padded={false} className="px-4">
            {deliveries.map((d) => (
              <ItemRow
                key={d.id}
                title={d.title}
                right={formatMoney(d.price)}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Итого</SectionTitle>
      <Card className="px-4 py-2">
        {works.length > 0 ? (
          <MoneyLine label="Работы" value={order.works_total} />
        ) : null}
        {shopParts.length > 0 ? (
          <MoneyLine label="Запчасти" value={order.shop_parts_total} />
        ) : null}
        {deliveries.length > 0 ? (
          <MoneyLine label="Доставки" value={order.deliveries_total} />
        ) : null}
        {discount > 0 ? (
          <View className="py-1">
            <Text className="text-sm" style={{ color: colors.success }}>
              Скидка {discount}% применена
            </Text>
          </View>
        ) : null}
        <View
          className="mt-1 flex-row justify-between border-t pt-2"
          style={{ borderColor: colors.line }}
        >
          <Text
            className="text-base font-semibold"
            style={{ color: colors.ink }}
          >
            Итого
          </Text>
          <Text
            className="text-base font-semibold"
            style={{ color: colors.ink }}
          >
            {formatMoney(order.grand_total)}
          </Text>
        </View>
      </Card>

      {order.client_comment ? (
        <>
          <SectionTitle>Комментарий</SectionTitle>
          <Card>
            <Text className="text-sm" style={{ color: colors.inkSoft }}>
              {order.client_comment}
            </Text>
          </Card>
        </>
      ) : null}

      <Button
        title={pdfBusy ? "Формирование PDF…" : "Счёт-заказ (PDF)"}
        variant="secondary"
        icon={pdfBusy ? "hourglass-outline" : "document-outline"}
        loading={pdfBusy}
        className="mt-6"
        onPress={() => void openPdf()}
      />
    </Screen>
  );
}
