import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchChatDetail,
  fetchChatMessages,
  sendChatMessage,
  type ChatMessage,
} from "../api/chats";
import { describeError } from "../api/errors";
import { useSession } from "../auth/session";
import { SkeletonRows, useToast } from "../components/ui";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { formatTime, parseServerDate } from "../utils/format";

function dayLabel(value: string): string {
  const date = parseServerDate(value);
  if (!date) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfToday) return "Сегодня";
  if (date >= startOfYesterday) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Row =
  | { type: "day"; key: string; label: string }
  | { type: "msg"; key: string; item: ChatMessage };

export function ChatThreadScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ChatThread">>();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const chatId = route.params.chatId;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const nextTempId = useRef(-1);
  const flatListRef = useRef<FlatList<Row>>(null);
  const prevMessagesLengthRef = useRef(0);

  const chatDetailQuery = useQuery({
    queryKey: ["chat-detail", chatId],
    queryFn: () => fetchChatDetail(chatId),
  });

  const chat = chatDetailQuery.data;

  const openContext = () => {
    if (!chat) return;
    if (chat.autoservice_booking_id) {
      navigation.navigate("BookingDetail", { id: chat.autoservice_booking_id });
    } else if (chat.autoservice_repair_order_id) {
      navigation.navigate("OrderDetail", { id: chat.autoservice_repair_order_id });
    }
  };

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", chatId],
    queryFn: () => fetchChatMessages(chatId),
    refetchInterval: 30_000,
  });

  const serverMessages = useMemo(
    () => (messagesQuery.data ?? []).slice().sort((a, b) => a.id - b.id),
    [messagesQuery.data],
  );

  const messages = useMemo(() => {
    const serverIds = new Set(serverMessages.map((m) => m.id));
    const pending = optimistic
      .filter((m) => !serverIds.has(m.id))
      .sort((a, b) => a.id - b.id);
    return [...serverMessages, ...pending];
  }, [serverMessages, optimistic]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let currentDay = "";
    messages.forEach((m) => {
      const label = dayLabel(m.created_at);
      if (label !== currentDay) {
        out.push({ type: "day", key: `d-${m.id}`, label });
        currentDay = label;
      }
      out.push({ type: "msg", key: `m-${m.id}`, item: m });
    });
    return out.reverse();
  }, [messages]);

  // Автоскролл при новых сообщениях если пользователь внизу
  useEffect(() => {
    const currentLength = messages.length;
    if (currentLength > prevMessagesLengthRef.current) {
      if (atBottom) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      } else {
        // Пользователь не внизу — показываем индикатор новых сообщений
        // eslint-disable-next-line react-hooks/set-state-in-effect -- индикатор новых сообщений при получении
        setHasNewMessages(true);
      }
    }
    prevMessagesLengthRef.current = currentLength;
  }, [messages.length, atBottom]);

  // Отслеживаем позицию скролла
  const onScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const isAtBottom = contentOffset.y < 10; // inverted список, offset 0 = низ
    setAtBottom(isAtBottom);
    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, []);

  const scrollToBottom = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setAtBottom(true);
    setHasNewMessages(false);
  };

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || !user?.id) return;
    const tempId = nextTempId.current--;
    const tempMessage: ChatMessage = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      message: text,
      is_read: false,
      created_at: new Date().toISOString(),
      media: [],
    };
    setOptimistic((prev) => [...prev, tempMessage]);
    setDraft("");
    setSending(true);
    try {
      const created = await sendChatMessage(chatId, user.id, text);
      // Подменяем временное сообщение реальным из ответа — без дублей до refetch.
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...created, id: created.id } : m)),
      );
      void queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["autoservice-chats"] });
      void queryClient.invalidateQueries({ queryKey: ["user-chats"] });
    } catch (e) {
      setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      show(describeError(e), "error");
    } finally {
      setSending(false);
    }
  }, [draft, sending, user, chatId, queryClient, show]);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.type === "day") {
      return (
        <View className="my-3 items-center">
          <Text
            className="rounded-full px-3 py-1 text-[11px] font-medium"
            style={{ backgroundColor: colors.surfaceSubtle, color: colors.inkMuted }}
          >
            {item.label}
          </Text>
        </View>
      );
    }
    const message = item.item;
    const mine = message.sender_id === user?.id;
    return (
      <View className={`mb-1.5 flex-row ${mine ? "justify-end" : "justify-start"}`}>
        <View
          className="max-w-[78%] rounded-2xl px-3.5 py-2.5"
          style={{
            backgroundColor: mine ? colors.brand : colors.surfaceSubtle,
            borderBottomRightRadius: mine ? 6 : 16,
            borderBottomLeftRadius: mine ? 16 : 6,
          }}
        >
          {!mine && message.sender_name ? (
            <Text className="mb-0.5 text-[11px] font-semibold" style={{ color: colors.brand }}>
              {message.sender_name}
            </Text>
          ) : null}
          <Text className="text-[15px] leading-5" style={{ color: mine ? "#fff" : colors.ink }}>
            {message.message}
          </Text>
          <Text
            className="mt-1 text-right text-[10px]"
            style={{ color: mine ? "rgba(255,255,255,0.7)" : colors.inkFaint }}
          >
            {formatTime(message.created_at)}
            {mine ? (message.is_read ? " · прочитано" : " · отправлено") : ""}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.surfaceMuted }}>
      {/* Плашка контекста */}
      {chat?.autoservice_context_label ? (
        <Pressable
          onPress={openContext}
          className="flex-row items-center gap-2 border-b px-4 py-2"
          style={{ backgroundColor: colors.surface, borderColor: colors.line }}
        >
          <Ionicons name="ribbon" size={16} color={colors.brand} />
          <Text className="flex-1 text-sm" style={{ color: colors.ink }}>
            {chat.autoservice_context_label}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.inkSoft} />
        </Pressable>
      ) : null}

      {messagesQuery.isLoading ? (
        <View className="flex-1 px-4 pt-4">
          <SkeletonRows count={8} />
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={rows}
            keyExtractor={(item) => item.key}
            renderItem={renderRow}
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10 }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onRefresh={() => {
              setManualRefreshing(true);
              void messagesQuery
                .refetch()
                .finally(() => setManualRefreshing(false));
            }}
            refreshing={manualRefreshing}
            inverted
          />

          {/* Кнопка «вниз» при скролле вверх */}
          {!atBottom && (
            <Pressable
              onPress={scrollToBottom}
              className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.brand, elevation: 4 }}
            >
              <Ionicons name="chevron-down" size={24} color="#fff" />
              {hasNewMessages && (
                <View
                  className="absolute -right-1 -top-1 h-4 w-4 rounded-full"
                  style={{ backgroundColor: colors.danger }}
                />
              )}
            </Pressable>
          )}
        </>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View
          className="flex-row items-end border-t px-3 py-2"
          style={{
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
            paddingBottom: Math.max(insets.bottom, 8),
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Сообщение…"
            placeholderTextColor={colors.inkFaint}
            multiline
            className="max-h-28 flex-1 rounded-2xl px-3.5 py-2.5 text-[15px]"
            style={{ backgroundColor: colors.surfaceSubtle, color: colors.ink }}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={!draft.trim() || sending}
            className="ml-2 h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: draft.trim() ? colors.brand : colors.line }}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
