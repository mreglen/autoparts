import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
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
import { Button, Card, Screen, useToast } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { formatMoney } from "../utils/format";
import { AppText as Text } from "../components/ui/AppText";

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
    <Card className="items-center px-6 py-10">
      <Ionicons name={icon} size={48} color={colors.brand} />
      <Text className="mt-4 text-xl font-bold" style={{ color: colors.ink }}>
        {title}
      </Text>
      <Text className="mt-2 text-center text-sm" style={{ color: colors.inkMuted }}>
        {text}
      </Text>
      {actions ? <View className="mt-6 flex-row gap-3">{actions}</View> : null}
    </Card>
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
              <Button title="Мои заказы" className="flex-1" onPress={goPurchases} />
              <Button title="В поиск" variant="outline" className="flex-1" onPress={() => navigation.popToTop()} />
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
              <Button title="Оформить снова" className="flex-1" onPress={goCheckout} />
              <Button title="В корзину" variant="outline" className="flex-1" onPress={goCart} />
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
            <Button title="Обновить статус" onPress={() => void refetch()} />
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
            <Button title="Мои заказы" onPress={goPurchases} />
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
            <Button title="К оформлению" onPress={goCheckout} />
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

      <Card className="mt-6 px-5 py-6">
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
      </Card>

      <Card className="mt-4 px-5 py-6">
        <Text className="text-base font-semibold" style={{ color: colors.ink }}>
          Банковская карта
        </Text>
        <Text className="mt-1 text-sm" style={{ color: colors.inkMuted }}>
          Visa, Mastercard, Мир — оплата на защищённой странице
        </Text>
        <Button
          title="Оплатить картой"
          loading={cardLoading}
          disabled={status !== "awaiting_payment"}
          className="mt-5"
          onPress={() => void handleCard()}
        />
        {session?.card_payment_status ? (
          <Text className="mt-2 text-center text-xs" style={{ color: colors.inkFaint }}>
            Статус: {session.card_payment_status}
          </Text>
        ) : null}
      </Card>

      <Text className="mt-4 text-center text-xs" style={{ color: colors.inkFaint }}>
        После успешной оплаты заказ будет автоматически отправлен поставщику
      </Text>
    </Screen>
  );
}
