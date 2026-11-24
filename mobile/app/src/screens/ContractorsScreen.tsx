import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  createContractor,
  fetchContractors,
  patchContractor,
  type Contractor,
  type ContractorPayload,
  type PageResponse,
} from "../api/directory";
import { describeError } from "../api/errors";
import {
  MoneyField,
  Screen,
  Sheet,
  SkeletonRows,
  StaleDataBadge,
  useToast,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme/useTheme";

type Props = NativeStackScreenProps<RootStackParamList, "Contractors">;

const SALARY_TYPES = [
  { id: "fixed", label: "Фиксированная сумма" },
  { id: "percent_work", label: "% от работ" },
] as const;

function ContractorForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Contractor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [salaryType, setSalaryType] = useState<string>(
    initial?.salary_type === "percent_work" ? "percent_work" : "fixed",
  );
  const [salaryAmount, setSalaryAmount] = useState(
    initial?.salary_type === "percent_work"
      ? ""
      : String(initial?.salary_amount ?? ""),
  );
  const [workPercent, setWorkPercent] = useState(
    initial?.salary_type === "percent_work" ? String(initial.work_percent) : "",
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: colors.surfaceSubtle,
    color: colors.ink,
  } as const;

  const num = (s: string) => {
    const n = Number(String(s).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Укажите наименование подрядчика");
      return;
    }
    const body: ContractorPayload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      salary_type: salaryType,
      salary_amount: salaryType === "fixed" ? num(salaryAmount) : null,
      work_percent: salaryType === "percent_work" ? num(workPercent) : null,
      is_active: isActive,
    };
    setBusy(true);
    try {
      if (initial) await patchContractor(initial.id, body);
      else await createContractor(body);
      show(initial ? "Подрядчик обновлён" : "Подрядчик добавлен", "success");
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
        placeholder="Наименование *"
        placeholderTextColor={colors.inkFaint}
        className="rounded-xl px-4 py-3 text-base"
        style={inputStyle}
      />
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Телефон"
        placeholderTextColor={colors.inkFaint}
        className="rounded-xl px-4 py-3 text-base"
        style={inputStyle}
        keyboardType="phone-pad"
      />
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Комментарий"
        placeholderTextColor={colors.inkFaint}
        className="rounded-xl px-4 py-3 text-base"
        style={inputStyle}
        multiline
      />
      <Text
        className="text-xs font-semibold uppercase"
        style={{ color: colors.inkMuted }}
      >
        Оплата
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {SALARY_TYPES.map((t) => {
          const active = salaryType === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setSalaryType(t.id)}
              className="rounded-full px-4 py-2"
              style={{
                backgroundColor: active ? colors.brand : colors.surfaceSubtle,
              }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: active ? "#fff" : colors.inkSoft }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {salaryType === "fixed" ? (
        <MoneyField
          value={salaryAmount}
          onChangeText={setSalaryAmount}
          placeholder="Сумма за работу"
          className="rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
      ) : (
        <MoneyField
          value={workPercent}
          onChangeText={setWorkPercent}
          placeholder="Процент от 0 до 100"
          className="rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
      )}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm" style={{ color: colors.ink }}>
          Активен
        </Text>
        <Switch
          value={isActive}
          onValueChange={setIsActive}
          trackColor={{ false: colors.surfaceSubtle, true: colors.brand }}
        />
      </View>
      <Pressable
        onPress={() => void save()}
        disabled={busy}
        className="items-center rounded-xl py-3.5"
        style={{ backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold" style={{ color: "#fff" }}>
            {initial ? "Сохранить" : "Добавить"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

export function ContractorsScreen(_: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Contractor[]>([]);
  const [page, setPage] = useState<PageResponse<Contractor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [editing, setEditing] = useState<Contractor | "new" | null>(null);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const r = await fetchContractors({ q: query || undefined, limit: 50 });
        setRows(r.data.items);
        setPage(r.data);
        setStale(r.stale ? r.fetchedAt : null);
        offsetRef.current = r.data.items.length;
        hasMoreRef.current = r.data.has_more;
        setHasMore(r.data.has_more);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, show],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 400);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    try {
      const r = await fetchContractors({
        q: query || undefined,
        limit: 50,
        offset: offsetRef.current,
      });
      setRows((prev) => [...prev, ...r.data.items]);
      offsetRef.current += r.data.items.length;
      hasMoreRef.current = r.data.has_more;
      setHasMore(r.data.has_more);
      setStale(r.stale ? r.fetchedAt : null);
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <View
          className="flex-1 flex-row items-center gap-2 rounded-xl px-3"
          style={{ backgroundColor: colors.surfaceSubtle }}
        >
          <Ionicons name="search" size={16} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Название"
            placeholderTextColor={colors.inkFaint}
            className="flex-1 py-2.5 text-sm"
            style={{ color: colors.ink }}
          />
        </View>
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
          Подрядчики не добавлены
        </Text>
      ) : (
        <View className="gap-2">
          {rows.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setEditing(c)}
              className="flex-row items-center gap-3 rounded-2xl p-3"
              style={{
                backgroundColor: colors.surfaceSubtle,
                opacity: c.is_active ? 1 : 0.55,
              }}
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.brandSoft }}
              >
                <Ionicons name="construct" size={18} color={colors.brand} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  {c.name}
                  {!c.is_active ? " · неактивен" : ""}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors.inkMuted }}
                  numberOfLines={1}
                >
                  {[c.phone, c.note].filter(Boolean).join(" · ") || "—"}
                </Text>
                <Text className="text-xs" style={{ color: colors.inkFaint }}>
                  {c.salary_type === "percent_work"
                    ? `${c.work_percent}% от работ`
                    : `фикс. ${c.salary_amount ?? 0}`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.inkFaint}
              />
            </Pressable>
          ))}
          {hasMore ? (
            <Pressable
              onPress={() => void loadMore()}
              disabled={loadingMore}
              className="items-center rounded-2xl py-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              {loadingMore ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.brand }}
                >
                  Показать ещё{page ? ` (${rows.length}/${page.total})` : ""}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      )}

      <Sheet
        visible={editing !== null}
        title={editing === "new" ? "Новый подрядчик" : "Подрядчик"}
        onClose={() => setEditing(null)}
      >
        {editing !== null ? (
          <ContractorForm
            initial={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => void load(true)}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}
