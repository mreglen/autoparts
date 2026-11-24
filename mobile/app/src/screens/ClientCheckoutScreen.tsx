import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMyProfile } from "../api/profile";
import {
  createShopPaymentSession,
  createShopUnpaidOrder,
  fetchShopAdminOrgAddress,
  fetchShopCart,
  fetchShopCheckoutConfig,
  fetchShopSiteDelivery,
  type ShopOrderPayload,
  type SiteDeliveryOption,
} from "../api/partsShop";
import { describeError } from "../api/errors";
import {
  ConfirmDialog,
  Screen,
  SkeletonRows,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import {
  cartTotal,
  formatMoney,
  formatPhoneInput,
  normalizeEmail,
  normalizeFullName,
  normalizePickupOption,
  truncateRubles,
  validateEmail,
  validateFullName,
  validatePhone,
} from "../utils/partsShop";

const OFFER_URL = "https://svoygarage.ru/offer";

export function ClientCheckoutScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  const [fullNameEdit, setFullNameEdit] = useState<string | null>(null);
  const [phoneEdit, setPhoneEdit] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState<string | null>(null);
  const [deliverInParts, setDeliverInParts] = useState(false);
  const [acceptedOffer, setAcceptedOffer] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState<"pay" | "unpaid" | null>(null);
  const [unpaidConfirm, setUnpaidConfirm] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<number | null>(null);

  const inputStyle = {
    backgroundColor: colors.surfaceSubtle,
    color: colors.ink,
  } as const;

  const { data: cart, isLoading: cartLoading } = useQuery({
    queryKey: ["shop-cart"],
    queryFn: fetchShopCart,
  });
  const { data: config } = useQuery({
    queryKey: ["shop-checkout-config"],
    queryFn: fetchShopCheckoutConfig,
    staleTime: 60_000,
  });
  const { data: deliveryOptions } = useQuery({
    queryKey: ["shop-site-delivery"],
    queryFn: fetchShopSiteDelivery,
    staleTime: 5 * 60_000,
  });
  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
    staleTime: 5 * 60_000,
  });
  const { data: orgAddress } = useQuery({
    queryKey: ["shop-admin-org-address"],
    queryFn: fetchShopAdminOrgAddress,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const basket = (cart?.new_parts_baskets ?? []).find((b) => b.is_default);
  const items = basket?.items ?? cart?.new_parts_items ?? [];
  const total = cartTotal(items);

  const profileName = profile
    ? [profile.last_name, profile.first_name, profile.patronymic]
        .filter(Boolean)
        .join(" ")
    : "";
  const fullName = fullNameEdit ?? profileName;
  const phone = phoneEdit ?? (profile?.phone ? formatPhoneInput(profile.phone) : "");
  const email = emailEdit ?? profile?.email ?? "";

  const pickupOption: SiteDeliveryOption | null = useMemo(
    () => normalizePickupOption(deliveryOptions),
    [deliveryOptions],
  );

  const pickupAddress =
    pickupOption?.pickup_point?.trim() || orgAddress?.address?.trim() || "";
  const minOrderAmount = Number(pickupOption?.min_order_amount ?? 0) || 0;
  const meetsMinOrder = total >= minOrderAmount;

  const nameError = validateFullName(fullName);
  const phoneError = validatePhone(phone);
  const emailError = validateEmail(email);
  const recipientValid = !nameError && !phoneError && !emailError && Boolean(fullName.trim());

  const buildPayload = (): ShopOrderPayload => ({
    recipient_name: normalizeFullName(fullName),
    recipient_phone: phone,
    recipient_email: normalizeEmail(email) || undefined,
    deliver_in_parts: deliverInParts,
    delivery_type: "pickup",
    pickup_address: pickupAddress || null,
    delivery_region_id: pickupOption?.region_id ?? null,
    delivery_region_name: pickupOption?.region_name ?? null,
    delivery_option_id: pickupOption?.id ?? null,
  });

  const validate = (): boolean => {
    setShowErrors(true);
    if (!recipientValid) {
      show("Проверьте контактные данные получателя", "error");
      return false;
    }
    if (!pickupAddress) {
      show("Адрес самовывоза не настроен — попробуйте позже", "error");
      return false;
    }
    if (!meetsMinOrder) {
      show(`Минимальная сумма заказа — ${formatMoney(minOrderAmount)}`, "error");
      return false;
    }
    if (!acceptedOffer) {
      show("Подтвердите согласие с офертой", "error");
      return false;
    }
    return true;
  };

  const handlePay = async () => {
    if (submitting || !validate()) return;
    setSubmitting("pay");
    try {
      const session = await createShopPaymentSession(buildPayload());
      await queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
      navigation.replace("ClientPayment", { sessionId: session.session_id });
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSubmitting(null);
    }
  };

  const handleUnpaid = async () => {
    if (submitting) return;
    setSubmitting("unpaid");
    try {
      const result = await createShopUnpaidOrder(buildPayload());
      await queryClient.invalidateQueries({ queryKey: ["shop-cart"] });
      setUnpaidConfirm(false);
      setPlacedOrder(result.order_id);
    } catch (e) {
      setUnpaidConfirm(false);
      show(describeError(e), "error");
    } finally {
      setSubmitting(null);
    }
  };

  if (placedOrder != null) {
    return (
      <Screen>
        <View
          className="items-center rounded-2xl px-6 py-10"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Ionicons name="checkmark-circle" size={48} color={colors.success ?? colors.brand} />
          <Text className="mt-4 text-xl font-bold" style={{ color: colors.ink }}>
            Заказ оформлен
          </Text>
          <Text className="mt-2 text-center text-sm" style={{ color: colors.inkMuted }}>
            Заказ №{placedOrder} появится в разделе «Мои заказы».
          </Text>
          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={() => navigation.replace("ClientPurchases")}
              className="rounded-xl px-5 py-3"
              style={{ backgroundColor: colors.brand }}
            >
              <Text className="font-semibold text-white">Мои заказы</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.popToTop()}
              className="rounded-xl px-5 py-3"
              style={{ borderWidth: 1, borderColor: colors.line }}
            >
              <Text className="font-semibold" style={{ color: colors.ink }}>
                В поиск
              </Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  if (cartLoading) {
    return (
      <Screen scroll={false}>
        <SkeletonRows count={4} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        <Text className="py-10 text-center text-sm" style={{ color: colors.inkMuted }}>
          Корзина пуста — добавьте запчасти перед оформлением.
        </Text>
      </Screen>
    );
  }

  const err = (msg: string) =>
    showErrors && msg ? (
      <Text className="mt-1 text-xs" style={{ color: colors.danger }}>
        {msg}
      </Text>
    ) : null;

  return (
    <Screen>
      <Text className="mb-2 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
        Состав заказа · {items.length} поз.
      </Text>
      <View className="mb-4 rounded-xl px-4 py-3" style={{ backgroundColor: colors.surfaceSubtle }}>
        {items.map((item) => (
          <View key={item.id} className="flex-row items-center justify-between py-1">
            <Text className="min-w-0 flex-1 text-sm" style={{ color: colors.ink }} numberOfLines={1}>
              {item.name || item.partnumber} × {item.quantity}
            </Text>
            <Text className="ml-3 text-sm font-medium" style={{ color: colors.ink }}>
              {formatMoney(truncateRubles(Number(item.price ?? 0)) * item.quantity)}
            </Text>
          </View>
        ))}
        <View className="mt-2 flex-row items-center justify-between border-t pt-2" style={{ borderColor: colors.line }}>
          <Text className="font-semibold" style={{ color: colors.ink }}>
            Итого
          </Text>
          <Text className="text-lg font-bold" style={{ color: colors.brand }}>
            {formatMoney(total)}
          </Text>
        </View>
      </View>

      <Text className="mb-2 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
        Получатель
      </Text>
      <TextInput
        value={fullName}
        onChangeText={(v) => setFullNameEdit(normalizeFullName(v))}
        onBlur={() => setFullNameEdit(normalizeFullName(fullName))}
        placeholder="ФИО (фамилия, имя, отчество)"
        placeholderTextColor={colors.inkFaint}
        className="mb-1 rounded-xl px-4 py-3 text-base"
        style={inputStyle}
      />
      {err(nameError)}
      <TextInput
        value={phone}
        onChangeText={(v) => setPhoneEdit(formatPhoneInput(v))}
        placeholder="+7 (___) ___-__-__"
        placeholderTextColor={colors.inkFaint}
        keyboardType="phone-pad"
        className="mb-1 mt-2 rounded-xl px-4 py-3 text-base"
        style={inputStyle}
      />
      {err(phoneError)}
      <TextInput
        value={email}
        onChangeText={(v) => setEmailEdit(v.replace(/\s+/g, "").toLowerCase())}
        placeholder="Email для чека и уведомлений"
        placeholderTextColor={colors.inkFaint}
        keyboardType="email-address"
        autoCapitalize="none"
        className="mb-1 mt-2 rounded-xl px-4 py-3 text-base"
        style={inputStyle}
      />
      {err(emailError)}

      <Text className="mb-2 mt-5 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
        Получение
      </Text>
      <View className="rounded-xl px-4 py-3" style={{ backgroundColor: colors.surfaceSubtle }}>
        <View className="flex-row items-center gap-2">
          <Ionicons name="storefront-outline" size={18} color={colors.brand} />
          <Text className="flex-1 text-sm" style={{ color: colors.ink }}>
            {pickupAddress || "Адрес самовывоза уточняется"}
          </Text>
        </View>
        {pickupOption?.region_name ? (
          <Text className="mt-1 text-xs" style={{ color: colors.inkFaint }}>
            {pickupOption.region_name}
          </Text>
        ) : null}
        {minOrderAmount > 0 && !meetsMinOrder ? (
          <Text className="mt-2 text-xs" style={{ color: colors.danger }}>
            Минимальная сумма для самовывоза — {formatMoney(minOrderAmount)}
          </Text>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: colors.surfaceSubtle }}>
        <View className="min-w-0 flex-1">
          <Text className="text-sm" style={{ color: colors.ink }}>
            Отправлять частями по мере поступления
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: colors.inkFaint }}>
            Удобно, если не все позиции в наличии сразу
          </Text>
        </View>
        <Switch
          value={deliverInParts}
          onValueChange={setDeliverInParts}
          trackColor={{ true: colors.brand }}
        />
      </View>

      <Pressable
        onPress={() => setAcceptedOffer((v) => !v)}
        className="mt-4 flex-row items-start gap-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: colors.surfaceSubtle }}
      >
        <Ionicons
          name={acceptedOffer ? "checkbox" : "square-outline"}
          size={22}
          color={acceptedOffer ? colors.brand : colors.inkFaint}
          style={{ marginTop: 1 }}
        />
        <Text className="flex-1 text-sm" style={{ color: colors.ink }}>
          Согласен с условиями{" "}
          <Text
            className="font-medium"
            style={{ color: colors.brand }}
            onPress={() => void Linking.openURL(OFFER_URL)}
          >
            публичной оферты
          </Text>{" "}
          и политикой конфиденциальности
        </Text>
      </Pressable>

      <Pressable
        onPress={() => void handlePay()}
        disabled={submitting != null}
        className="mt-4 items-center rounded-xl py-4"
        style={{ backgroundColor: colors.brand, opacity: submitting ? 0.7 : 1 }}
      >
        {submitting === "pay" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">
            Оплатить {formatMoney(total)}
          </Text>
        )}
      </Pressable>
      <Text className="mt-2 text-center text-xs" style={{ color: colors.inkFaint }}>
        СБП или банковская карта · заказ создаётся после оплаты
      </Text>

      {config?.allow_unpaid_checkout ? (
        <Pressable
          onPress={() => {
            if (!validate()) return;
            setUnpaidConfirm(true);
          }}
          disabled={submitting != null}
          className="mt-3 items-center rounded-xl py-3"
          style={{ borderWidth: 1, borderColor: colors.line }}
        >
          <Text className="font-medium" style={{ color: colors.ink }}>
            Оформить без оплаты
          </Text>
        </Pressable>
      ) : null}

      <ConfirmDialog
        visible={unpaidConfirm}
        title="Оформить заказ без оплаты?"
        message="Заказ будет создан и ожидает подтверждения."
        confirmLabel={submitting === "unpaid" ? "Оформление…" : "Оформить"}
        onConfirm={() => void handleUnpaid()}
        onCancel={() => setUnpaidConfirm(false)}
      />
    </Screen>
  );
}
