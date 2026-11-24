import { useCallback, useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  BOOKING_SOURCE_LABELS,
  bookingStatusLabel,
  fetchBookings,
  patchBooking,
  sendBookingSms,
  type InspectionBooking,
} from "../api/bookings";
import { canAccessSection, PERM, hasPermission } from "../auth/access";
import { currentPermissionCodes } from "../auth/permissions";
import { useSession } from "../auth/session";
import { describeError } from "../api/errors";
import {
  AppHeader,
  Button,
  Card,
  ConfirmDialog,
  Screen,
  Sheet,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { formatDayMonth } from "../utils/format";
import { AppText as Text } from "../components/ui/AppText";

type Props = NativeStackScreenProps<RootStackParamList, "BookingDetail">;

const NEXT_ACTIONS: {
  status: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    status: "confirmed",
    label: "Подтвердить",
    icon: "checkmark-circle-outline",
  },
  {
    status: "processed",
    label: "Отметить обработанной",
    icon: "construct-outline",
  },
  {
    status: "cancelled",
    label: "Отменить запись",
    icon: "close-circle-outline",
  },
];

export function BookingDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useSession();
  const { show } = useToast();
  const { id } = route.params;
  const codes = currentPermissionCodes();
  const canConfirm = hasPermission(user, codes, PERM.inspectionsConfirm);
  const canOrders = canAccessSection(user, codes, "orders");

  const [booking, setBooking] = useState<InspectionBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionSheet, setActionSheet] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    status: string;
    label: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchBookings({ sort_by: "created_at" });
      const found = result.data.find((b) => b.id === id) ?? null;
      setBooking(found);
      setStaleAt(result.fromCache ? result.fetchedAt : null);
      setError(found ? "" : "Запись не найдена");
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

  const confirmBooking = () =>
    runAction("confirm", async () => {
      await patchBooking(id, { status: "confirmed" });
      show("Запись подтверждена", "success");
    });

  const changeStatus = (status: string, label: string) =>
    runAction(`status-${status}`, async () => {
      await patchBooking(id, { status });
      show(`Статус: ${label.toLowerCase()}`, "success");
    });

  const sendSms = () =>
    runAction("sms", async () => {
      const result = await sendBookingSms(id);
      if (result?.status === "sent") {
        const cost =
          result.cost != null ? ` · ${Number(result.cost).toFixed(2)} ₽` : "";
        show(`SMS отправлено${cost}`, "success");
      } else {
        show(result?.error_message || "SMS не отправлено", "error");
      }
    });

  if (loading) {
    return (
      <Screen>
        <SkeletonRows count={5} />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen className="items-center justify-center">
        <Text className="text-sm" style={{ color: colors.inkMuted }}>
          {error || "Запись не найдена"}
        </Text>
      </Screen>
    );
  }

  const vehicleLabel =
    [booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(" ") ||
    (booking.vehicle
      ? [booking.vehicle.make, booking.vehicle.model].filter(Boolean).join(" ")
      : "") ||
    "—";

  const rows: { label: string; value: string }[] = [
    { label: "Клиент", value: booking.name },
    ...(booking.phone ? [{ label: "Телефон", value: booking.phone }] : []),
    {
      label: "Дата и время",
      value:
        formatDayMonth(booking.preferred_date) +
        (booking.preferred_time
          ? ` ${String(booking.preferred_time).slice(0, 5)}`
          : ""),
    },
    { label: "Автомобиль", value: vehicleLabel },
    {
      label: "Источник",
      value:
        BOOKING_SOURCE_LABELS[booking.source ?? ""] ?? booking.source ?? "—",
    },
    ...(booking.notes ? [{ label: "Комментарий", value: booking.notes }] : []),
  ];

  const allowedActions = NEXT_ACTIONS.filter((a) => {
    if (booking.status === "cancelled") return false;
    if (a.status === "confirmed") return booking.status === "new" && canConfirm;
    if (a.status === "processed") return booking.status !== "processed";
    return booking.status !== "cancelled";
  });

  return (
    <Screen>
      <AppHeader
        title={booking.name}
        subtitle={bookingStatusLabel(booking.status)}
        right={staleAt ? <StaleDataBadge fetchedAt={staleAt} /> : null}
      />

      <Card>
        {rows.map((row, i) => (
          <View
            key={row.label}
            className={`flex-row justify-between py-1.5 ${i > 0 ? "border-t" : ""}`}
            style={{ borderColor: colors.line }}
          >
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              {row.label}
            </Text>
            <Text
              className="max-w-[60%] text-right text-sm font-medium"
              style={{ color: colors.ink }}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </Card>

      {booking.phone ? (
        <View className="mt-3">
          <Button
            title="Позвонить"
            variant="secondary"
            icon="call-outline"
            onPress={() => void Linking.openURL(`tel:${booking.phone}`)}
          />
        </View>
      ) : null}

      {allowedActions.length > 0 || booking.phone ? (
        <View className="mt-4 gap-2">
          {booking.status === "new" && canConfirm ? (
            <Button
              title={busy === "confirm" ? "Подтверждение…" : "Подтвердить запись"}
              variant="primary"
              loading={busy === "confirm"}
              disabled={busy !== null && busy !== "confirm"}
              onPress={() => void confirmBooking()}
            />
          ) : null}

          <Button
            title="Другие действия"
            variant="outline"
            onPress={() => setActionSheet(true)}
          />

          {booking.phone ? (
            <Button
              title={busy === "sms" ? "Отправка SMS…" : "Отправить SMS"}
              variant="outline"
              loading={busy === "sms"}
              disabled={busy !== null && busy !== "sms"}
              onPress={() => void sendSms()}
            />
          ) : null}
        </View>
      ) : null}

      <Sheet
        visible={actionSheet}
        title="Действия"
        onClose={() => setActionSheet(false)}
      >
        <View className="gap-2">
          {canOrders ? (
            <Button
              title="Создать заказ-наряд"
              variant="secondary"
              icon="construct-outline"
              onPress={() => {
                setActionSheet(false);
                navigation.navigate("OrderForm", { bookingId: id });
              }}
            />
          ) : null}
          {NEXT_ACTIONS.filter((a) => allowedActions.includes(a)).map((a) => (
            <Button
              key={a.status}
              title={a.label}
              variant="outline"
              icon={a.icon}
              onPress={() =>
                setPendingAction({ status: a.status, label: a.label })
              }
            />
          ))}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={pendingAction !== null}
        title={pendingAction?.label ?? ""}
        message="Изменить статус записи?"
        destructive={pendingAction?.status === "cancelled"}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (action) void changeStatus(action.status, action.label);
        }}
        onCancel={() => setPendingAction(null)}
      />
    </Screen>
  );
}
