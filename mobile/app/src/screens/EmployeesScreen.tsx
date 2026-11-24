import { useCallback, useEffect, useState } from "react";
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
  createEmployee,
  fetchEmployees,
  patchEmployee,
  SALARY_TYPE_LABELS,
  type EmployeePayload,
  type SalaryType,
  type ServiceEmployee,
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

type Props = NativeStackScreenProps<RootStackParamList, "Employees">;

const SALARY_TYPES = Object.keys(SALARY_TYPE_LABELS) as SalaryType[];

function EmployeeForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: ServiceEmployee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [position, setPosition] = useState(initial?.position ?? "");
  const [salaryType, setSalaryType] = useState<SalaryType>(
    initial?.salary_type ?? "percent_work",
  );
  const [salaryAmount, setSalaryAmount] = useState(
    initial ? String(initial.salary_amount) : "",
  );
  const [workPercent, setWorkPercent] = useState(
    initial ? String(initial.work_percent) : "",
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    backgroundColor: colors.surfaceSubtle,
    color: colors.ink,
  } as const;

  const num = (s: string) => Number(String(s).replace(",", ".")) || 0;

  const save = async () => {
    setError("");
    if (!name.trim()) {
      setError("Укажите имя сотрудника");
      return;
    }
    const body: EmployeePayload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      position: position.trim() || undefined,
      salary_type: salaryType,
      salary_amount: num(salaryAmount),
      work_percent: num(workPercent),
      is_active: isActive,
    };
    setBusy(true);
    try {
      if (initial) await patchEmployee(initial.id, body);
      else await createEmployee(body);
      show(initial ? "Сотрудник обновлён" : "Сотрудник добавлен", "success");
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
        placeholder="Имя *"
        placeholderTextColor={colors.inkFaint}
        className="rounded-xl px-4 py-3 text-base"
        style={inputStyle}
      />
      <View className="flex-row gap-2">
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Телефон"
          placeholderTextColor={colors.inkFaint}
          className="flex-1 rounded-xl px-4 py-3 text-base"
          style={inputStyle}
          keyboardType="phone-pad"
        />
        <TextInput
          value={position}
          onChangeText={setPosition}
          placeholder="Должность"
          placeholderTextColor={colors.inkFaint}
          className="flex-1 rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
      </View>
      <Text
        className="text-xs font-semibold uppercase"
        style={{ color: colors.inkMuted }}
      >
        Тип оплаты
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {SALARY_TYPES.map((t) => {
          const active = salaryType === t;
          return (
            <Pressable
              key={t}
              onPress={() => setSalaryType(t)}
              className="rounded-full px-4 py-2"
              style={{
                backgroundColor: active ? colors.brand : colors.surfaceSubtle,
              }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: active ? "#fff" : colors.inkSoft }}
              >
                {SALARY_TYPE_LABELS[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        <MoneyField
          value={salaryAmount}
          onChangeText={setSalaryAmount}
          placeholder={
            salaryType === "percent_work"
              ? "Ставка %"
              : salaryType === "daily_rate"
                ? "Ставка за смену"
                : "Оклад"
          }
          className="flex-1 rounded-xl px-4 py-3 text-base"
          style={inputStyle}
        />
        {salaryType !== "fixed" ? (
          <MoneyField
            value={workPercent}
            onChangeText={setWorkPercent}
            placeholder="% от работ"
            className="flex-1 rounded-xl px-4 py-3 text-base"
            style={inputStyle}
          />
        ) : null}
      </View>
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

export function EmployeesScreen(_: Props) {
  const { colors } = useTheme();
  const { show } = useToast();
  const [rows, setRows] = useState<ServiceEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [editing, setEditing] = useState<ServiceEmployee | "new" | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const r = await fetchEmployees(true);
        setRows(r.data);
        setStale(r.stale ? r.fetchedAt : null);
      } catch (e) {
        show(describeError(e), "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <Screen onRefresh={() => void load(true)} refreshing={refreshing}>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: colors.ink }}>
          Сотрудники
        </Text>
        <View className="flex-row items-center gap-2">
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
      </View>

      {loading ? (
        <SkeletonRows count={6} />
      ) : rows.length === 0 ? (
        <Text
          className="py-8 text-center text-sm"
          style={{ color: colors.inkMuted }}
        >
          Сотрудники не добавлены
        </Text>
      ) : (
        <View className="gap-2">
          {rows.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => setEditing(e)}
              className="flex-row items-center gap-3 rounded-2xl p-3"
              style={{
                backgroundColor: colors.surfaceSubtle,
                opacity: e.is_active ? 1 : 0.55,
              }}
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                  backgroundColor: colors.brandSoft ?? colors.surfaceSubtle,
                }}
              >
                <Ionicons name="person" size={18} color={colors.brand} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.ink }}
                >
                  {e.name}
                  {!e.is_active ? " · неактивен" : ""}
                </Text>
                <Text className="text-xs" style={{ color: colors.inkMuted }}>
                  {[e.position, e.phone].filter(Boolean).join(" · ") || "—"}
                </Text>
                <Text className="text-xs" style={{ color: colors.inkFaint }}>
                  {SALARY_TYPE_LABELS[e.salary_type] ?? e.salary_type}
                  {" · "}
                  {e.salary_type === "percent_work"
                    ? `${e.work_percent}% от работ`
                    : `ставка ${e.salary_amount}`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.inkFaint}
              />
            </Pressable>
          ))}
        </View>
      )}

      <Sheet
        visible={editing !== null}
        title={editing === "new" ? "Новый сотрудник" : "Сотрудник"}
        onClose={() => setEditing(null)}
      >
        {editing !== null ? (
          <EmployeeForm
            initial={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => void load(true)}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}
