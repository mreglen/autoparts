import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import {
  fetchAutoserviceChats,
  fetchUserChats,
  isAutoserviceChat,
  openClientAutoserviceChat,
  type ChatListItem,
} from "../api/chats";
import { describeError } from "../api/errors";
import { useAppRole } from "../auth/roles";
import { hasPermission, PERM } from "../auth/access";
import { currentPermissionCodes } from "../auth/permissions";
import { useSession } from "../auth/session";
import { ListRow, Screen, SkeletonRows, useToast } from "../components/ui";
import { NotificationsBell } from "../components/NotificationsBell";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { formatDayMonth, plural } from "../utils/format";

function chatTitle(chat: ChatListItem, isClient: boolean): string {
  if (isClient) return chat.organization_name || "Автосервис";
  return chat.title || chat.buyer_name || "Клиент автосервиса";
}

function chatTimeLabel(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "только что";
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} ${plural(mins, "минуту", "минуты", "минут")} назад`;
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    return `${hours} ${plural(hours, "час", "часа", "часов")} назад`;
  }
  return formatDayMonth(value);
}

export function ChatsScreen() {
  const { colors } = useTheme();
  const { user } = useSession();
  const { activeRole, clientOrgs } = useAppRole();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { show } = useToast();
  const [opening, setOpening] = useState(false);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);

  const isClient = activeRole === "client";
  const codes = currentPermissionCodes();
  const canStaffChat = !isClient && hasPermission(user, codes, PERM.chat);

  const staffQuery = useQuery({
    queryKey: ["autoservice-chats"],
    queryFn: fetchAutoserviceChats,
    enabled: canStaffChat,
    refetchInterval: 20_000,
  });
  const clientQuery = useQuery({
    queryKey: ["user-chats"],
    queryFn: fetchUserChats,
    enabled: isClient,
    refetchInterval: 20_000,
  });

  const chats = useMemo(() => {
    const raw = isClient
      ? (clientQuery.data?.data?.chats ?? [])
      : (staffQuery.data ?? []);
    return raw
      .filter((c) => (isClient ? isAutoserviceChat(c) : c.chat_type === "autoservice"))
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.last_message?.created_at || 0).getTime() -
          new Date(a.updated_at || a.last_message?.created_at || 0).getTime(),
      );
  }, [isClient, clientQuery.data, staffQuery.data]);

  const loading = isClient ? clientQuery.isLoading : staffQuery.isLoading;

  const openThread = (chat: ChatListItem) => {
    navigation.navigate("ChatThread", {
      chatId: chat.id,
      title: chatTitle(chat, isClient),
    });
  };

  const handleWriteToService = async (organizationId?: string | null) => {
    if (opening) return;
    setOpening(true);
    try {
      const chat = await openClientAutoserviceChat(organizationId);
      openThread(chat);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setOpening(false);
      setOrgPickerOpen(false);
    }
  };

  const handleClientWritePress = () => {
    if (clientOrgs.length > 1) {
      setOrgPickerOpen(true);
    } else {
      void handleWriteToService(clientOrgs[0]?.organization_id ?? null);
    }
  };

  const emptyText = isClient
    ? "Чатов с автосервисом пока нет"
    : "Клиентских чатов пока нет";

  return (
    <Screen scroll={false} contentContainerStyle={{ padding: 0 }}>
      <View className="px-4 pb-2 pt-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xl font-bold" style={{ color: colors.ink }}>
            Сообщения
          </Text>
          <View className="flex-row items-center gap-2">
            <NotificationsBell />
          {isClient ? (
            <Pressable
              onPress={handleClientWritePress}
              disabled={opening}
              className="flex-row items-center rounded-xl px-3 py-2"
              style={{ backgroundColor: colors.brandSoft }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.brand} />
              <Text className="ml-1.5 text-sm font-semibold" style={{ color: colors.brand }}>
                {opening ? "Открытие…" : "Написать"}
              </Text>
            </Pressable>
          ) : canStaffChat ? (
            <Pressable
              onPress={() => navigation.navigate("NewClientChat")}
              className="flex-row items-center rounded-xl px-3 py-2"
              style={{ backgroundColor: colors.brandSoft }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.brand} />
              <Text className="ml-1.5 text-sm font-semibold" style={{ color: colors.brand }}>
                Клиенту
              </Text>
            </Pressable>
          ) : null}
          </View>
        </View>
      </View>

      {loading ? (
        <View className="px-4">
          <SkeletonRows count={6} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          onRefresh={() => {
            if (isClient) void clientQuery.refetch();
            else void staffQuery.refetch();
          }}
          refreshing={isClient ? clientQuery.isRefetching : staffQuery.isRefetching}
          ListEmptyComponent={
            <Text className="py-10 text-center text-sm" style={{ color: colors.inkMuted }}>
              {emptyText}
            </Text>
          }
          renderItem={({ item }) => {
            const lastText = item.last_message?.message || item.last_message_text || "";
            const lastAt = item.last_message?.created_at || item.updated_at;
            const unread = item.unread_count > 0;
            const initial = (chatTitle(item, isClient) || "Ч").charAt(0).toUpperCase();
            return (
              <Pressable
                onPress={() => openThread(item)}
                className="mb-2 flex-row items-center rounded-2xl px-3 py-3"
                style={{ backgroundColor: colors.surfaceSubtle }}
              >
                <View
                  className="mr-3 h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.brandSoft }}
                >
                  <Text className="text-base font-bold" style={{ color: colors.brand }}>
                    {initial}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="flex-1 text-[15px]"
                      style={{ color: colors.ink, fontWeight: unread ? "700" : "600" }}
                      numberOfLines={1}
                    >
                      {chatTitle(item, isClient)}
                    </Text>
                    <Text className="ml-2 text-[11px]" style={{ color: colors.inkFaint }}>
                      {chatTimeLabel(lastAt)}
                    </Text>
                  </View>
                  {item.autoservice_context_label ? (
                    <Text className="mt-0.5 text-xs" style={{ color: colors.inkMuted }} numberOfLines={1}>
                      {item.autoservice_context_label}
                    </Text>
                  ) : null}
                  <View className="mt-0.5 flex-row items-center">
                    <Text
                      className="flex-1 text-sm"
                      style={{ color: unread ? colors.inkSoft : colors.inkMuted }}
                      numberOfLines={1}
                    >
                      {lastText || "Нет сообщений"}
                    </Text>
                    {unread ? (
                      <View
                        className="ml-2 h-5 min-w-[20px] items-center justify-center rounded-full px-1.5"
                        style={{ backgroundColor: colors.brand }}
                      >
                        <Text className="text-[11px] font-bold" style={{ color: "#fff" }}>
                          {item.unread_count}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={orgPickerOpen} transparent animationType="fade" onRequestClose={() => setOrgPickerOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/40 p-6" onPress={() => setOrgPickerOpen(false)}>
          <Pressable
            className="w-full max-w-sm rounded-2xl p-2"
            style={{ backgroundColor: colors.surface }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="px-3 pb-2 pt-1 text-base font-semibold" style={{ color: colors.ink }}>
              Выберите автосервис
            </Text>
            {clientOrgs.map((org) => (
              <ListRow
                key={org.organization_id}
                title={org.organization_name ?? org.organization_id}
                onPress={() => void handleWriteToService(org.organization_id)}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
