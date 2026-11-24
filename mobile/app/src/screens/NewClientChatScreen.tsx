import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import {
  fetchChatClientTopics,
  openAutoserviceClientChat,
  searchChatClients,
  type AutoserviceChatClient,
} from "../api/chats";
import { describeError } from "../api/errors";
import { Screen, SkeletonRows, useToast } from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { formatDayMonth, formatTime } from "../utils/format";

type Topic =
  | { type: "general" }
  | { type: "booking"; id: number }
  | { type: "order"; id: number };

const BOOKING_STATUS: Record<string, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  in_progress: "В работе",
  done: "Выполнена",
  cancelled: "Отменена",
  processed: "Обработана",
};

const ORDER_STATUS: Record<string, string> = {
  pending: "Ожидание",
  in_progress: "В работе",
  done: "Выполнен",
  completed: "Закрыт",
  cancelled: "Отменён",
  review: "На проверке",
};

function bookingDateLabel(booking: { preferred_date: string; preferred_time?: string | null }) {
  const date = formatDayMonth(booking.preferred_date);
  const time = booking.preferred_time ? formatTime(booking.preferred_time) : "";
  return [date, time].filter(Boolean).join(", ");
}

export function NewClientChatScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { show } = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [client, setClient] = useState<AutoserviceChatClient | null>(null);
  const [topic, setTopic] = useState<Topic>({ type: "general" });
  const [opening, setOpening] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const clientsQuery = useQuery({
    queryKey: ["chat-clients", debounced],
    queryFn: () => searchChatClients(debounced),
    enabled: !client,
  });

  const topicsQuery = useQuery({
    queryKey: ["chat-client-topics", client?.id],
    queryFn: () => fetchChatClientTopics(client!.id),
    enabled: Boolean(client),
  });

  const handleSelectClient = (c: AutoserviceChatClient) => {
    setClient(c);
    setTopic({ type: "general" });
  };

  const handleOpen = async () => {
    if (!client || opening) return;
    setOpening(true);
    try {
      const chat = await openAutoserviceClientChat({
        clientId: client.id,
        bookingId: topic.type === "booking" ? topic.id : null,
        repairOrderId: topic.type === "order" ? topic.id : null,
      });
      navigation.replace("ChatThread", {
        chatId: chat.id,
        title: chat.title || client.name,
      });
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setOpening(false);
    }
  };

  const topicButton = (
    active: boolean,
    title: string,
    subtitle?: string,
    onPress?: () => void,
  ) => (
    <Pressable
      key={title}
      onPress={onPress}
      className="mb-2 rounded-2xl border px-3.5 py-3"
      style={{
        backgroundColor: active ? colors.brandSoft : colors.surface,
        borderColor: active ? colors.brand : colors.line,
      }}
    >
      <Text className="text-[15px] font-medium" style={{ color: colors.ink }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-0.5 text-xs" style={{ color: colors.inkMuted }} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <Screen scroll={false} contentContainerStyle={{ padding: 0 }}>
      <View className="flex-1 px-4 pt-3">
        {!client ? (
          <>
            <Text className="mb-3 text-xl font-bold" style={{ color: colors.ink }}>
              Написать клиенту
            </Text>
            <View
              className="mb-3 flex-row items-center rounded-xl px-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Ionicons name="search" size={16} color={colors.inkFaint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Имя или телефон клиента"
                placeholderTextColor={colors.inkFaint}
                className="flex-1 py-2.5 pl-2 text-[15px]"
                style={{ color: colors.ink }}
                autoFocus
              />
            </View>
            {clientsQuery.isLoading ? (
              <SkeletonRows count={6} />
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                {(clientsQuery.data ?? []).length === 0 ? (
                  <Text className="py-8 text-center text-sm" style={{ color: colors.inkMuted }}>
                    Клиенты не найдены
                  </Text>
                ) : (
                  (clientsQuery.data ?? []).map((c) => {
                    const hasAccount = Boolean(c.user_id);
                    return (
                      <Pressable
                        key={c.id}
                        disabled={!hasAccount}
                        onPress={() => handleSelectClient(c)}
                        className="mb-2 flex-row items-center justify-between rounded-2xl px-4 py-3"
                        style={{
                          backgroundColor: colors.surfaceSubtle,
                          opacity: hasAccount ? 1 : 0.55,
                        }}
                      >
                        <View className="min-w-0 flex-1">
                          <Text className="text-[15px] font-medium" style={{ color: colors.ink }} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Text className="text-xs" style={{ color: colors.inkMuted }} numberOfLines={1}>
                            {c.phone}
                          </Text>
                        </View>
                        {!hasAccount ? (
                          <Text className="ml-2 text-xs" style={{ color: colors.inkFaint }}>
                            нет аккаунта
                          </Text>
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            )}
          </>
        ) : (
          <>
            <View className="mb-3 flex-row items-center">
              <Pressable onPress={() => setClient(null)} className="mr-2 p-1">
                <Ionicons name="arrow-back" size={22} color={colors.ink} />
              </Pressable>
              <Text className="flex-1 text-xl font-bold" style={{ color: colors.ink }} numberOfLines={1}>
                Чат с {client.name}
              </Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="mb-2 mt-1 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
                Тема переписки
              </Text>
              {topicButton(topic.type === "general", "Общая переписка", "без привязки к заказу", () =>
                setTopic({ type: "general" }),
              )}
              {topicsQuery.isLoading ? (
                <SkeletonRows count={4} />
              ) : (
                <>
                  {(topicsQuery.data?.bookings?.length ?? 0) > 0 ? (
                    <>
                      <Text className="mb-2 mt-3 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
                        Записи на осмотр
                      </Text>
                      {topicsQuery.data!.bookings.map((b) =>
                        topicButton(
                          topic.type === "booking" && topic.id === b.id,
                          `Запись №${b.id} · ${bookingDateLabel(b)}`,
                          [b.vehicle_label, BOOKING_STATUS[b.status] || b.status].filter(Boolean).join(" · "),
                          () => setTopic({ type: "booking", id: b.id }),
                        ),
                      )}
                    </>
                  ) : null}
                  {(topicsQuery.data?.orders?.length ?? 0) > 0 ? (
                    <>
                      <Text className="mb-2 mt-3 text-xs font-semibold uppercase" style={{ color: colors.inkFaint }}>
                        Заказ-наряды
                      </Text>
                      {topicsQuery.data!.orders.map((o) =>
                        topicButton(
                          topic.type === "order" && topic.id === o.id,
                          `Заказ-наряд №${o.order_number || o.id}`,
                          [o.vehicle_label, ORDER_STATUS[o.status] || o.status].filter(Boolean).join(" · "),
                          () => setTopic({ type: "order", id: o.id }),
                        ),
                      )}
                    </>
                  ) : null}
                </>
              )}
              <Pressable
                onPress={() => void handleOpen()}
                disabled={opening}
                className="mb-8 mt-4 items-center rounded-xl py-3.5"
                style={{ backgroundColor: colors.brand, opacity: opening ? 0.6 : 1 }}
              >
                <Text className="text-base font-semibold" style={{ color: "#fff" }}>
                  {opening ? "Открытие…" : "Открыть чат"}
                </Text>
              </Pressable>
            </ScrollView>
          </>
        )}
      </View>
    </Screen>
  );
}
