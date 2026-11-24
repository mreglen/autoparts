import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  createExpenseArticle,
  deleteExpenseArticle,
  fetchExpenseArticles,
  patchExpenseArticle,
  type FinanceExpenseArticle,
} from "../api/finance";
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
import { inputChrome } from "../components/ui/chrome";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

type Props = NativeStackScreenProps<RootStackParamList, "ExpenseArticles">;

function ArticleForm({
  initial,
  onClose,
  onSaved,
  onDelete,
}: {
  initial: FinanceExpenseArticle | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const inputStyle = inputChrome(colors);

  const save = async () => {
    setError("");
    const cleaned = name.trim();
    if (!cleaned) {
      setError("Укажите название статьи");
      return;
    }
    setBusy(true);
    try {
      if (initial) await patchExpenseArticle(initial.id, cleaned);
      else await createExpenseArticle(cleaned);
      show(initial ? "Статья обновлена" : "Статья добавлена", "success");
      onSaved();
      onClose();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3">
      {error ? (
        <Text className="text-sm" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Название статьи *"
        placeholderTextColor={colors.inkFaint}
        className="rounded-xl px-4 py-3 text-base"
        style={inputStyle}
        autoFocus={!initial}
        maxLength={120}
      />
      <Button
        title={initial ? "Сохранить" : "Добавить"}
        onPress={() => void save()}
        loading={busy}
      />
      {initial ? (
        <Button
          title="Удалить статью"
          variant="danger"
          disabled={busy}
          onPress={onDelete}
        />
      ) : null}
    </View>
  );
}

export function ExpenseArticlesScreen(_: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [rows, setRows] = useState<FinanceExpenseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [editing, setEditing] = useState<FinanceExpenseArticle | "new" | null>(
    null,
  );
  const [deleting, setDeleting] = useState<FinanceExpenseArticle | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await fetchExpenseArticles();
      setRows(r.data);
      setStale(r.stale ? r.fetchedAt : null);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [show]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const doDelete = async () => {
    if (!deleting) return;
    try {
      await deleteExpenseArticle(deleting.id);
      show("Статья удалена", "success");
      setDeleting(null);
      setEditing(null);
      await load(true);
    } catch (e) {
      show(describeError(e), "error");
    }
  };

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <AppHeader title="Статьи расходов" />
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Text
          className="flex-1 text-sm"
          style={{ color: colors.inkMuted }}
          numberOfLines={1}
        >
          {loading ? "Загрузка…" : `${rows.length} статей`}
        </Text>
        <StaleDataBadge fetchedAt={stale} />
        <Pressable
          onPress={() => setEditing("new")}
          className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
          style={{ backgroundColor: colors.brand }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="text-sm font-semibold" style={{ color: "#fff" }}>
            Добавить
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <SkeletonRows count={6} />
      ) : rows.length === 0 ? (
        <Text
          className="py-8 text-center text-sm"
          style={{ color: colors.inkMuted }}
        >
          Статьи расходов не добавлены
        </Text>
      ) : (
        <View className="gap-2">
          {rows.map((a) => (
            <Pressable key={a.id} onPress={() => setEditing(a)}>
              <Card padded={false}>
                <View className="flex-row items-center gap-3 p-3.5">
                  <View className="min-w-0 flex-1">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.ink }}
                      numberOfLines={1}
                    >
                      {a.name}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.inkFaint}
                  />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <Sheet
        visible={editing !== null}
        title={editing === "new" ? "Новая статья" : "Статья расхода"}
        onClose={() => setEditing(null)}
      >
        {editing !== null ? (
          <ArticleForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => void load(true)}
            onDelete={() =>
              editing !== "new" ? setDeleting(editing) : undefined
            }
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        visible={deleting !== null}
        title="Удалить статью?"
        message={`«${deleting?.name ?? ""}» будет удалена. Расходы по ней сохранятся без привязки к статье.`}
        confirmLabel="Удалить"
        destructive
        onConfirm={() => void doDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Screen>
  );
}
