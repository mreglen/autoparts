import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  createFinanceExpense,
  fetchEmployeePayrollInfo,
  fetchExpenseArticles,
  patchFinanceExpense,
  type FinanceExpense,
  type FinanceExpenseArticle,
  type EmployeePayrollInfo,
} from "../../api/finance";
import { fetchEmployees, type ServiceEmployee } from "../../api/directory";
import { describeError } from "../../api/errors";
import { useTheme } from "../../theme/useTheme";
import { formatMoney, toIsoDate } from "../../utils/format";
import { DatePickerField, MoneyField, Sheet, useToast } from "../ui";

interface ExpenseFormSheetProps {
  /** null — создание, иначе редактирование существующего расхода. Компонент монтируется при открытии. */
  initial: FinanceExpense | null;
  onClose: () => void;
  onSaved: () => void;
}

function FieldLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      className="mb-1.5 text-xs font-medium"
      style={{ color: colors.inkMuted }}
    >
      {children}
    </Text>
  );
}

function parseAmount(value: string): number {
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const PINNED_ARTICLES = ["Заработная плата", "Прочее"];
const SALARY_ARTICLE_NAMES = ["зарплата", "заработная плата"];

export function ExpenseFormSheet({
  initial,
  onClose,
  onSaved,
}: ExpenseFormSheetProps) {
  const { colors } = useTheme();
  const { show } = useToast();
  const isEdit = initial != null;

  const [articleId, setArticleId] = useState<number | null>(
    initial?.article_id ?? null,
  );
  const [articleName, setArticleName] = useState(initial?.article_name ?? "");
  const [articleOpen, setArticleOpen] = useState(false);
  const [amount, setAmount] = useState(() =>
    initial?.amount != null ? String(initial.amount) : "",
  );
  const [expenseDate, setExpenseDate] = useState(
    () => initial?.expense_date ?? toIsoDate(new Date()),
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [employeeId, setEmployeeId] = useState<number | null>(
    initial?.employee_id ?? null,
  );
  const [employeeSheetOpen, setEmployeeSheetOpen] = useState(false);

  const [employees, setEmployees] = useState<ServiceEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [articles, setArticles] = useState<FinanceExpenseArticle[]>([]);

  const payrollKey = `${employeeId ?? "-"}|${expenseDate}`;
  const [payroll, setPayroll] = useState<{
    key: string;
    data: EmployeePayrollInfo | null;
  } | null>(null);
  const [payrollLoadingKey, setPayrollLoadingKey] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const resolvedArticleName = (
    articleId != null
      ? (articles.find((a) => a.id === articleId)?.name ?? articleName)
      : articleName
  ).trim();
  const isSalaryArticle = SALARY_ARTICLE_NAMES.includes(
    resolvedArticleName.toLowerCase(),
  );
  const isSalary = isEdit ? initial.type === "salary" : isSalaryArticle;
  const showEmployee = isSalary;
  const payrollLoading = payrollLoadingKey === payrollKey;
  const payrollInfo = payroll?.key === payrollKey ? payroll.data : null;

  useEffect(() => {
    let alive = true;
    fetchEmployees(false)
      .then((r) => {
        if (alive) setEmployees(r.data);
      })
      .catch(() => {
        if (alive) setEmployees([]);
      })
      .finally(() => {
        if (alive) setEmployeesLoading(false);
      });
    fetchExpenseArticles()
      .then((r) => {
        if (!alive) return;
        setArticles(r.data);
        if (initial?.article_id != null && !initial.article_name) {
          const found = r.data.find((a) => a.id === initial.article_id);
          if (found) setArticleName(found.name);
        }
      })
      .catch(() => {
        if (alive) setArticles([]);
      });
    return () => {
      alive = false;
    };
  }, [initial]);

  useEffect(() => {
    if (!showEmployee || employeeId == null || !expenseDate) return;
    const key = payrollKey;
    let alive = true;
    const timer = setTimeout(() => {
      if (!alive) return;
      setPayrollLoadingKey(key);
      const [year, month] = expenseDate.split("-").map(Number);
      fetchEmployeePayrollInfo(employeeId, year, month)
        .then((r) => {
          if (alive) setPayroll({ key, data: r.data });
        })
        .catch(() => {
          if (alive) setPayroll({ key, data: null });
        })
        .finally(() => {
          if (alive) setPayrollLoadingKey(null);
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [showEmployee, employeeId, expenseDate, payrollKey]);

  const amountNumber = useMemo(() => parseAmount(amount), [amount]);
  const amountValid = amountNumber > 0;
  const mergedArticles = useMemo<{ id: number | null; name: string }[]>(() => {
    const byName = new Map(
      articles.map((a) => [a.name.trim().toLowerCase(), a]),
    );
    const defaults = PINNED_ARTICLES.map(
      (name) => byName.get(name.toLowerCase()) ?? { id: null, name },
    );
    const rest = articles.filter(
      (a) => !PINNED_ARTICLES.includes(a.name.trim().toLowerCase()),
    );
    return [...defaults, ...rest];
  }, [articles]);
  const normalizedSearch = articleName.trim().toLowerCase();
  const filteredArticles = useMemo(
    () =>
      mergedArticles.filter((a) =>
        a.name.toLowerCase().includes(normalizedSearch),
      ),
    [mergedArticles, normalizedSearch],
  );
  const exactArticleMatch = mergedArticles.some(
    (a) => a.name.toLowerCase() === normalizedSearch,
  );
  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null;

  const canSubmit =
    amountValid &&
    Boolean(expenseDate) &&
    (isEdit || resolvedArticleName.length > 0) &&
    (!isSalary || employeeId != null);

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const base = {
        article_id: articleId,
        article_name: articleId ? null : resolvedArticleName || null,
        amount: amountNumber,
        expense_date: expenseDate,
        description: description.trim() || null,
      };
      if (isEdit && initial) {
        await patchFinanceExpense(initial.id, {
          ...base,
          type: initial.type,
          employee_id: isSalary ? employeeId : null,
        });
      } else {
        await createFinanceExpense({
          ...base,
          type: isSalaryArticle ? "salary" : "other",
          employee_id: isSalaryArticle ? employeeId : null,
        });
      }
      show(isEdit ? "Расход обновлён" : "Расход добавлен", "success");
      onSaved();
      onClose();
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const today = useMemo(() => new Date(), []);

  return (
    <Sheet
      visible
      title={isEdit ? "Редактировать расход" : "Новый расход"}
      onClose={onClose}
    >
      <View className="gap-3">
        <View>
          <FieldLabel>Статья расхода</FieldLabel>
          <View className="relative">
            <TextInput
              value={articleName}
              onChangeText={(v) => {
                setArticleName(v);
                setArticleId(null);
                setArticleOpen(true);
              }}
              onFocus={() => setArticleOpen(true)}
              onBlur={() => setTimeout(() => setArticleOpen(false), 150)}
              placeholder="Выберите или введите новую"
              placeholderTextColor={colors.inkFaint}
              editable={!saving}
              autoComplete="off"
              className="rounded-xl px-4 py-3 text-base"
              style={{
                backgroundColor: colors.surfaceSubtle,
                color: colors.ink,
                minHeight: 48,
              }}
            />
            {articleOpen ? (
              <View
                className="absolute inset-x-0 top-full mt-1 max-h-56 overflow-hidden rounded-xl"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  zIndex: 20,
                  elevation: 8,
                }}
              >
                <ScrollView keyboardShouldPersistTaps="handled">
                  {isEdit ? (
                    <Pressable
                      onPress={() => {
                        setArticleId(null);
                        setArticleName("");
                        setArticleOpen(false);
                      }}
                      className="px-3 py-2.5"
                      style={{ backgroundColor: colors.surfaceSubtle }}
                    >
                      <Text
                        className="text-sm"
                        style={{ color: colors.inkMuted }}
                      >
                        Не указана
                      </Text>
                    </Pressable>
                  ) : null}
                  {articleName.trim() && !exactArticleMatch ? (
                    <Pressable
                      onPress={() => setArticleOpen(false)}
                      className="px-3 py-2.5"
                      style={{ backgroundColor: colors.brandSoft }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: colors.brand }}
                      >
                        Использовать «{articleName.trim()}»
                      </Text>
                    </Pressable>
                  ) : null}
                  {filteredArticles.map((a) => (
                    <Pressable
                      key={a.id ?? a.name}
                      onPress={() => {
                        setArticleId(a.id);
                        setArticleName(a.name);
                        setArticleOpen(false);
                      }}
                      className="px-3 py-2.5"
                      style={{ backgroundColor: colors.surfaceSubtle }}
                    >
                      <Text
                        className="text-sm"
                        style={{ color: colors.ink }}
                        numberOfLines={1}
                      >
                        {a.name}
                      </Text>
                    </Pressable>
                  ))}
                  {filteredArticles.length === 0 && !articleName.trim() ? (
                    <Text
                      className="px-3 py-2.5 text-sm"
                      style={{ color: colors.inkMuted }}
                    >
                      Статей пока нет — введите название
                    </Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <FieldLabel>Сумма, ₽</FieldLabel>
            <MoneyField
              value={amount}
              onChangeText={setAmount}
              editable={!saving}
            />
          </View>
          <View className="flex-1">
            <DatePickerField
              label="Дата"
              value={expenseDate}
              onChange={setExpenseDate}
              maximumDate={today}
            />
          </View>
        </View>

        {showEmployee ? (
          <View>
            <FieldLabel>Сотрудник</FieldLabel>
            <Pressable
              onPress={() => setEmployeeSheetOpen(true)}
              disabled={saving || employeesLoading}
              className="flex-row items-center justify-between rounded-xl px-4"
              style={{
                backgroundColor: colors.surfaceSubtle,
                minHeight: 48,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text
                className="text-base"
                style={{
                  color: selectedEmployee ? colors.ink : colors.inkFaint,
                }}
              >
                {employeesLoading
                  ? "Загрузка сотрудников…"
                  : (selectedEmployee?.name ?? "Выберите сотрудника")}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.inkMuted} />
            </Pressable>
          </View>
        ) : null}

        {showEmployee && employeeId != null ? (
          <View
            className="rounded-xl p-3"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            {payrollLoading ? (
              <Text className="text-sm" style={{ color: colors.inkMuted }}>
                Загрузка зарплаты…
              </Text>
            ) : payrollInfo ? (
              <View className="gap-1">
                <PayrollRow
                  label="Начислено"
                  value={payrollInfo.total_accrued}
                />
                <PayrollRow label="Выдано" value={payrollInfo.total_paid} />
                <PayrollRow
                  label="Осталось"
                  value={payrollInfo.remaining}
                  tone={
                    Number(payrollInfo.remaining) >= 0
                      ? colors.success
                      : colors.danger
                  }
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View>
          <FieldLabel>Описание (необязательно)</FieldLabel>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Необязательно"
            placeholderTextColor={colors.inkFaint}
            editable={!saving}
            multiline
            className="rounded-xl px-4 py-3 text-base"
            style={{
              backgroundColor: colors.surfaceSubtle,
              color: colors.ink,
              minHeight: 72,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View className="mt-1 flex-row gap-2">
          <Pressable
            onPress={onClose}
            disabled={saving}
            className="flex-1 items-center rounded-xl py-3"
            style={{ backgroundColor: colors.surfaceSubtle }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: colors.inkSoft }}
            >
              Отмена
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={!canSubmit || saving}
            className="flex-1 items-center rounded-xl py-3"
            style={{
              backgroundColor: colors.brand,
              opacity: canSubmit && !saving ? 1 : 0.6,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-sm font-semibold text-white">
                {isEdit ? "Сохранить" : "Создать"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Шторка выбора сотрудника */}
      <Sheet
        visible={employeeSheetOpen}
        title="Сотрудник"
        onClose={() => setEmployeeSheetOpen(false)}
      >
        <ScrollView className="max-h-96">
          {!isSalary ? (
            <Pressable
              onPress={() => {
                setEmployeeId(null);
                setEmployeeSheetOpen(false);
              }}
              className="mb-2 rounded-xl p-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Text className="text-sm" style={{ color: colors.inkMuted }}>
                Не указан
              </Text>
            </Pressable>
          ) : null}
          {employees.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => {
                setEmployeeId(e.id);
                setEmployeeSheetOpen(false);
              }}
              className="mb-2 rounded-xl p-3"
              style={{ backgroundColor: colors.surfaceSubtle }}
            >
              <Text className="text-sm" style={{ color: colors.ink }}>
                {e.name}
              </Text>
            </Pressable>
          ))}
          {employees.length === 0 && !employeesLoading ? (
            <Text className="py-3 text-sm" style={{ color: colors.inkMuted }}>
              Сотрудники не найдены
            </Text>
          ) : null}
        </ScrollView>
      </Sheet>
    </Sheet>
  );
}

function PayrollRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm" style={{ color: colors.inkMuted }}>
        {label}:
      </Text>
      <Text
        className="text-sm font-medium"
        style={{ color: tone ?? colors.ink }}
      >
        {formatMoney(value)}
      </Text>
    </View>
  );
}
