import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";

import {
  createShopCardPayment,
  fetchShopPaymentSession,
} from "../api/partsShop";
import { describeError } from "../api/errors";
import { Screen, useToast } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { formatMoney } from "../utils/format";

type PaymentRoute = RouteProp<RootStackParamList, "ClientPayment">;

const TERMINAL = new Set(["fulfilled", "expired", "fulfillment_failed", "refunded"]);

function ResultCard({
  icon,
  title,
  text,
  actions,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  actions?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      className="items-center rounded-2xl px-6 py-10"
      style={{ backgroundColor: colors.surfaceSubtle }}
    >
      <Ionicons name={icon} size={48} color={colors.brand} />
      <Text className="mt-4 text-xl font-bold" style={{ color: colors.ink }}>
        {title}
      </Text>
      <Text className="mt-2 text-center text-sm" style={{ color: colors.inkMuted }}>
        {text}
      </Text>
      {actions ? <View className="mt-6 flex-row gap-3">{actions}</View> : null}
    </View>
  );
}

export function ClientPaymentScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PaymentRoute>();
  const { sessionId } = route.params;
  const queryClient = useQueryClient();
  const [cardLoading, setCardLoading] = useState(false);
  const [cardOpened, setCardOpened] = useState(false);
  const fulfilledHandled = useRef(false);

  const { data: session, isLoading, refetch } = useQuery({
    queryKey: ["shop-payment", sessionId],
    queryFn: () => fetchShopPaymentSession(sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL.has(status) ? false : 3000;
    },
  });

  useEffect(() => {
    if (session?.status === "fulfilled") {
      void queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
      if (!fulfilledHandled.current) {
        fulfilledHandled.current = true;
        show("Оплата прошла — заказ оформлен", "success");
      }
    }
  }, [session?.status, queryClient, show]);

  const handleCard = useCallback(async () => {
    setCardLoading(true);
    try {
      const result = await createShopCardPayment(sessionId);
      if (result?.confirmation_url) {
        setCardOpened(true);
        await Linking.openURL(result.confirmation_url);
      } else {
        show("Не удалось получить ссылку на оплату картой", "error");
      }
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setCardLoading(false);
    }
  }, [sessionId, show]);

  const goPurchases = () => navigation.replace("ClientPurchases");
  const goCheckout = () => navigation.replace("ClientCheckout");
  const goCart = () => navigation.navigate("Main", { screen: "ClientCart" });

  if (isLoading && !session) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  const status = session?.status;

  if (status === "fulfilled") {
    return (
      <Screen>
        <ResultCard
          icon="checkmark-circle"
          title="Оплата прошла успешно"
          text={`Заказ №${session?.garage_order_id ?? ""} оформлен. Мы отправим его поставщику.`}
          actions={
            <>
              <Pressable onPress={goPurchases} className="rounded-xl px-5 py-3" style={{ backgroundColor: colors.brand }}>
                <Text className="font-semibold text-white">Мои заказы</Text>
              </Pressable>
              <Pressable onPress={() => navigation.popToTop()} className="rounded-xl px-5 py-3" style={{ borderWidth: 1, borderColor: colors.line }}>
                <Text className="font-semibold" style={{ color: colors.ink }}>В поиск</Text>
              </Pressable>
            </>
          }
        />
      </Screen>
    );
  }

  if (status === "refunded") {
    return (
      <Screen>
        <ResultCard
          icon="refresh-circle"
          title="Заказ не оформлен"
          text="Оплата прошла, но создать заказ не удалось. Средства возвращены на тот же способ оплаты."
          actions={
            <>
              <Pressable onPress={goCheckout} className="rounded-xl px-5 py-3" style={{ backgroundColor: colors.brand }}>
                <Text className="font-semibold text-white">Оформить снова</Text>
              </Pressable>
              <Pressable onPress={goCart} className="rounded-xl px-5 py-3" style={{ borderWidth: 1, borderColor: colors.line }}>
                <Text className="font-semibold" style={{ color: colors.ink }}>В корзину</Text>
              </Pressable>
            </>
          }
        />
      </Screen>
    );
  }

  if (status === "refund_pending") {
    return (
      <Screen>
        <ResultCard
          icon="time-outline"
          title="Возврат средств"
          text="Заказ не был создан. Возврат оплаты обрабатывается — обновите статус через минуту."
          actions={
            <Pressable onPress={() => void refetch()} className="rounded-xl px-5 py-3" style={{ backgroundColor: colors.brand }}>
              <Text className="font-semibold text-white">Обновить статус</Text>
            </Pressable>
          }
        />
      </Screen>
    );
  }

  if (status === "fulfillment_failed") {
    return (
      <Screen>
        <ResultCard
          icon="alert-circle-outline"
          title="Заказ не оформлен"
          text="Оплата прошла, но заказ создать не удалось. Автоматический возврат не выполнен — свяжитесь с поддержкой."
          actions={
            <Pressable onPress={goPurchases} className="rounded-xl px-5 py-3" style={{ backgroundColor: colors.brand }}>
              <Text className="font-semibold text-white">Мои заказы</Text>
            </Pressable>
          }
        />
      </Screen>
    );
  }

  if (status === "expired") {
    return (
      <Screen>
        <ResultCard
          icon="time-outline"
          title="Время оплаты истекло"
          text="Вернитесь в корзину и начните оформление заново."
          actions={
            <Pressable onPress={goCheckout} className="rounded-xl px-5 py-3" style={{ backgroundColor: colors.brand }}>
              <Text className="font-semibold text-white">К оформлению</Text>
            </Pressable>
          }
        />
      </Screen>
    );
  }

  const qrValue = session?.qr_payload || "";
  const statusLabel =
    status === "paid"
      ? "Платёж обрабатывается…"
      : session?.sbp_payment_status
        ? `Статус: ${session.sbp_payment_status}`
        : "Ожидание оплаты";

  return (
    <Screen>
      <Text className="text-2xl font-bold" style={{ color: colors.ink }}>
        Оплата заказа
      </Text>
      <Text className="mt-1 text-sm" style={{ color: colors.inkMuted }}>
        Сумма к оплате:{" "}
        <Text className="font-semibold" style={{ color: colors.ink }}>
          {formatMoney(session?.amount)}
        </Text>
      </Text>
      {cardOpened && status === "paid" ? (
        <Text className="mt-2 text-sm" style={{ color: colors.success ?? colors.brand }}>
          Платёж обрабатывается…
        </Text>
      ) : null}

      <View className="mt-6 rounded-2xl px-5 py-6" style={{ backgroundColor: colors.surfaceSubtle }}>
        <Text className="text-base font-semibold" style={{ color: colors.ink }}>
          СБП — QR-код
        </Text>
        <Text className="mt-1 text-sm" style={{ color: colors.inkMuted }}>
          Отсканируйте код в приложении банка
        </Text>
        <View className="mt-5 items-center">
          {qrValue ? (
            <View className="rounded-xl bg-white p-4">
              <QRCode value={qrValue} size={220} />
            </View>
          ) : (
            <Text className="text-sm" style={{ color: colors.inkMuted }}>
              {isLoading ? "Загрузка QR…" : "QR-код недоступен"}
            </Text>
          )}
          <Text className="mt-3 text-xs" style={{ color: colors.inkFaint }}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <View className="mt-4 rounded-2xl px-5 py-6" style={{ backgroundColor: colors.surfaceSubtle }}>
        <Text className="text-base font-semibold" style={{ color: colors.ink }}>
          Банковская карта
        </Text>
        <Text className="mt-1 text-sm" style={{ color: colors.inkMuted }}>
          Visa, Mastercard, Мир — оплата на защищённой странице
        </Text>
        <Pressable
          onPress={() => void handleCard()}
          disabled={cardLoading || status !== "awaiting_payment"}
          className="mt-5 items-center rounded-xl py-3.5"
          style={{
            backgroundColor: colors.brand,
            opacity: cardLoading || status !== "awaiting_payment" ? 0.5 : 1,
          }}
        >
          {cardLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-white">Оплатить картой</Text>
          )}
        </Pressable>
        {session?.card_payment_status ? (
          <Text className="mt-2 text-center text-xs" style={{ color: colors.inkFaint }}>
            Статус: {session.card_payment_status}
          </Text>
        ) : null}
      </View>

      <Text className="mt-4 text-center text-xs" style={{ color: colors.inkFaint }}>
        После успешной оплаты заказ будет автоматически отправлен поставщику
      </Text>
    </Screen>
  );
}
