import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { fetchBookings, type InspectionBooking } from "../api/bookings";
import { fetchOrder, fetchWorkZones } from "../api/orders";
import { fetchPlannerConflicts, type PlannerItem } from "../api/planner";
import {
  createClient,
  createOrder,
  createVehicle,
  fetchCatalogWorks,
  fetchClientVehicles,
  fetchClients,
  fetchContractorOptions,
  fetchServiceEmployeeOptions,
  updateOrder,
  type CatalogWork,
  type ContractorOption,
  type FormClient,
  type FormVehicle,
  type ServiceEmployeeOption,
} from "../api/orderForm";
import { describeError } from "../api/errors";
import {
  AppHeader,
  Button,
  ConfirmDialog,
  DateField,
  Screen,
  Sheet,
  useToast,
} from "../components/ui";
import { cardChrome, inputChrome } from "../components/ui/chrome";
import type { RootStackParamList } from "../navigation/types";
import { repairOrderDraftKey } from "../storage/keys";
import { useTheme } from "../theme/useTheme";
import { formatMoney, formatTime } from "../utils/format";
import {
  clearOrderDraft,
  readOrderDraft,
  writeOrderDraft,
} from "../utils/orderDrafts";
import { AppText as Text, AppTextInput as TextInput } from "../components/ui/AppText";

// ---------- Локальная модель формы ----------

interface ExecutorLine {
  employee_id: number;
  percent: string;
}

interface ContractorLine {
  contractor_id: number;
  amount: string;
}

interface WorkLine {
  key: number;
  catalog_work_id?: number | null;
  title: string;
  qty: string;
  price: string;
  executors: ExecutorLine[];
  contractors: ContractorLine[];
}

interface NamedLine {
  key: number;
  title: string;
}

interface ClientPartLine extends NamedLine {
  qty: string;
  unit: "pcs" | "l" | "kg";
}

interface ShopPartLine extends NamedLine {
  qty: string;
  unit: "pcs" | "l" | "kg";
  price: string;
  markup: string;
  id?: number | null;
}

interface DeliveryLine extends NamedLine {
  price: string;
}

interface FormState {
  clientId: number | null;
  clientLabel: string;
  vehicleId: number | null;
  vehicleLabel: string;
  clientName: string;
  clientPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  scheduledDate: string;
  scheduledTime: string;
  endDate: string;
  endTime: string;
  inspectionDate: string;
  inspectionTime: string;
  mileage: string;
  zoneId: number | null;
  discount: string;
  clientComment: string;
  staffComment: string;
  works: WorkLine[];
  clientParts: ClientPartLine[];
  shopParts: ShopPartLine[];
  deliveries: DeliveryLine[];
}

const EMPTY_FORM: FormState = {
  clientId: null,
  clientLabel: "",
  vehicleId: null,
  vehicleLabel: "",
  clientName: "",
  clientPhone: "",
  vehicleMake: "",
  vehicleModel: "",
  scheduledDate: "",
  scheduledTime: "",
  endDate: "",
  endTime: "",
  inspectionDate: "",
  inspectionTime: "",
  mileage: "",
  zoneId: null,
  discount: "",
  clientComment: "",
  staffComment: "",
  works: [],
  clientParts: [],
  shopParts: [],
  deliveries: [],
};

let lineKey = 1;
const nextKey = () => lineKey++;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function combineDateTime(date: string, time: string): string | null {
  if (!date || !DATE_RE.test(date)) return null;
  const t = time && TIME_RE.test(time) ? time : "00:00";
  return `${date}T${t}`;
}

function splitDateTime(value?: string | null): { d: string; t: string } {
  if (!value) return { d: "", t: "" };
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value);
  return m ? { d: m[1], t: m[2] } : { d: "", t: "" };
}

function num(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ---------- Мелкие UI-примитивы формы ----------

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

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View className="mb-3">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        keyboardType={keyboardType}
        multiline={multiline}
        className="rounded-xl px-4 py-3 text-base"
        style={{
          ...inputChrome(colors),
          minHeight: multiline ? 80 : 48,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full px-3.5 py-1.5"
      style={{
        backgroundColor: active ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.lineStrong,
      }}
    >
      <Text
        className="text-xs font-medium"
        style={{ color: active ? "#fff" : colors.inkSoft }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      className="mb-2 mt-1 text-xs font-semibold uppercase"
      style={{ color: colors.inkMuted }}
    >
      {children}
    </Text>
  );
}

function LineRow({
  title,
  subtitle,
  right,
  onDelete,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onDelete?: () => void;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 flex-row items-center gap-2 rounded-lg p-2.5"
      style={cardChrome(colors)}
    >
      <View className="min-w-0 flex-1">
        <Text
          className="text-sm font-medium"
          style={{ color: colors.ink }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-0.5 text-xs"
            style={{ color: colors.inkMuted }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <Text className="text-sm tabular-nums" style={{ color: colors.ink }}>
          {right}
        </Text>
      ) : null}
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button title={label} variant="secondary" icon="add" className="mb-3" onPress={onPress} />;
}

// ---------- Шторки-выборы ----------

function PickerSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ScrollView className="max-h-96">{children}</ScrollView>
    </Sheet>
  );
}

// ---------- Экран ----------

export function OrderFormScreen() {
  const { colors } = useTheme();
  const { show } = useToast();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "OrderForm">>();
  const params = route.params ?? {};
  const orderId = params.orderId ?? null;
  const isEdit = orderId != null;
  const bookingId = params.bookingId ?? null;
  const draftToken = params.draftToken ?? "";
  const draftKey = repairOrderDraftKey(
    isEdit ? "edit" : "create",
    orderId,
    draftToken || undefined,
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<PlannerItem[] | null>(null);

  const [zones, setZones] = useState<{ id: number; name: string }[]>([]);
  const [vatRate, setVatRate] = useState<number>(22);

  const [clientSheet, setClientSheet] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clients, setClients] = useState<FormClient[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [vehicleSheet, setVehicleSheet] = useState(false);
  const [vehicles, setVehicles] = useState<FormVehicle[]>([]);
  const [newVehicle, setNewVehicle] = useState({
    make: "",
    model: "",
    year: "",
    plate: "",
  });
  const [creatingVehicle, setCreatingVehicle] = useState(false);

  const [workSheet, setWorkSheet] = useState(false);
  const [workQuery, setWorkQuery] = useState("");
  const [catalogWorks, setCatalogWorks] = useState<CatalogWork[]>([]);
  const [manualWork, setManualWork] = useState({ title: "", price: "" });

  const [editWorkKey, setEditWorkKey] = useState<number | null>(null);
  const [employees, setEmployees] = useState<ServiceEmployeeOption[]>([]);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);

  const [partSheet, setPartSheet] = useState<
    "client" | "shop" | "delivery" | null
  >(null);
  const [partForm, setPartForm] = useState({
    title: "",
    qty: "1",
    unit: "pcs" as "pcs" | "l" | "kg",
    price: "",
    markup: "",
  });

  const patch = useCallback(
    (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p })),
    [],
  );

  const applyBookingPrefill = useCallback((b: InspectionBooking) => {
    const t = (b.preferred_time ?? "").slice(0, 5);
    setForm((prev) => ({
      ...prev,
      clientName: prev.clientName || b.name || "",
      clientPhone: prev.clientPhone || b.phone || "",
      vehicleMake: prev.vehicleMake || b.vehicle_make || b.vehicle?.make || "",
      vehicleModel:
        prev.vehicleModel || b.vehicle_model || b.vehicle?.model || "",
      inspectionDate: prev.inspectionDate || b.preferred_date || "",
      inspectionTime: prev.inspectionTime || (TIME_RE.test(t) ? t : ""),
      zoneId: prev.zoneId ?? b.work_zone_id ?? null,
      clientComment: prev.clientComment || b.notes || "",
    }));
  }, []);

  // --- Загрузка: черновик → заказ → пустая форма ---
  useEffect(() => {
    let alive = true;
    void (async () => {
      const draft = await readOrderDraft(draftKey);
      if (!alive) return;
      if (draft?.form && Object.keys(draft.form).length > 0) {
        setForm({
          ...EMPTY_FORM,
          ...(draft.form as Partial<FormState>),
          works: (draft.form.works as WorkLine[]) ?? [],
          clientParts: (draft.form.clientParts as ClientPartLine[]) ?? [],
          shopParts: (draft.form.shopParts as ShopPartLine[]) ?? [],
          deliveries: (draft.form.deliveries as DeliveryLine[]) ?? [],
        });
        setHydrated(true);
        return;
      }
      if (orderId != null) {
        try {
          const result = await fetchOrder(orderId);
          if (!alive) return;
          const o = result.data;
          const sAt = splitDateTime(o.scheduled_at);
          const eAt = splitDateTime(o.scheduled_end_at);
          const iAt = splitDateTime(o.inspection_scheduled_at);
          setForm({
            ...EMPTY_FORM,
            clientId: o.client?.id ?? o.client_id ?? null,
            clientLabel: o.client?.name ?? "",
            vehicleId: o.vehicle_id ?? o.vehicle?.id ?? null,
            vehicleLabel: o.vehicle
              ? [o.vehicle.make, o.vehicle.model, o.vehicle.plate]
                  .filter(Boolean)
                  .join(" ")
              : "",
            scheduledDate: sAt.d,
            scheduledTime: sAt.t,
            endDate: eAt.d,
            endTime: eAt.t,
            inspectionDate: iAt.d,
            inspectionTime: iAt.t,
            mileage: o.mileage_km != null ? String(o.mileage_km) : "",
            zoneId: o.work_zone_id ?? null,
            discount:
              o.discount_percent != null ? String(o.discount_percent) : "",
            clientComment: o.client_comment ?? "",
            staffComment: o.staff_comment ?? "",
            works: (o.works ?? []).map((w) => ({
              key: nextKey(),
              catalog_work_id: null,
              title: w.title,
              qty: String(w.qty),
              price: String(w.unit_price),
              executors: (w.executors ?? []).map((e) => ({
                employee_id: e.employee_id,
                percent: String(e.percent),
              })),
              contractors: (w.contractors ?? []).map((c) => ({
                contractor_id: c.contractor_id,
                amount: String(c.amount),
              })),
            })),
            clientParts: (o.client_parts ?? []).map((p) => ({
              key: nextKey(),
              title: p.title,
              qty: String(p.qty),
              unit: (p.unit as "pcs" | "l" | "kg") || "pcs",
            })),
            shopParts: (o.shop_parts ?? []).map((p) => ({
              key: nextKey(),
              id: p.id ?? null,
              title: p.title,
              qty: String(p.qty),
              unit: (p.unit as "pcs" | "l" | "kg") || "pcs",
              price: String(p.unit_price),
              markup: p.markup_percent != null ? String(p.markup_percent) : "",
            })),
            deliveries: (o.deliveries ?? []).map((d) => ({
              key: nextKey(),
              title: d.title,
              price: String(d.price),
            })),
          });
        } catch (e) {
          if (alive) show(describeError(e), "error");
        }
      } else if (bookingId != null) {
        try {
          const result = await fetchBookings();
          if (!alive) return;
          const b = result.data.find((x) => x.id === bookingId);
          if (b) applyBookingPrefill(b);
        } catch {
          /* prefill — best effort */
        }
      }
      if (alive) setHydrated(true);
    })();
    return () => {
      alive = false;
    };
    // draftKey стабилен на время жизни экрана
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Автосохранение черновика ---
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void writeOrderDraft(
        draftKey,
        form as unknown as Record<string, unknown>,
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [form, hydrated, draftKey]);

  // --- Справочники ---
  useEffect(() => {
    void fetchWorkZones()
      .then((r) => {
        setZones(r.data.work_zones ?? []);
        setVatRate(Number(r.data.vat_rate ?? 22) || 22);
      })
      .catch(() => {});
    void fetchServiceEmployeeOptions()
      .then((r) => setEmployees(r.data))
      .catch(() => setEmployees([]));
    void fetchContractorOptions()
      .then((r) => setContractors(r.data))
      .catch(() => setContractors([]));
  }, []);

  useEffect(() => {
    if (!clientSheet) return;
    const t = setTimeout(() => {
      void fetchClients(clientQuery)
        .then((r) => setClients(r.data.slice(0, 30)))
        .catch(() => setClients([]));
    }, 300);
    return () => clearTimeout(t);
  }, [clientSheet, clientQuery]);

  useEffect(() => {
    if (!vehicleSheet || !form.clientId) return;
    void fetchClientVehicles(form.clientId)
      .then((r) => setVehicles(r.data))
      .catch(() => setVehicles([]));
  }, [vehicleSheet, form.clientId]);

  useEffect(() => {
    if (!workSheet) return;
    const t = setTimeout(() => {
      void fetchCatalogWorks(workQuery)
        .then((r) =>
          setCatalogWorks(
            r.data.filter((w) => w.is_active !== false).slice(0, 30),
          ),
        )
        .catch(() => setCatalogWorks([]));
    }, 300);
    return () => clearTimeout(t);
  }, [workSheet, workQuery]);

  // --- Действия со списками ---

  const selectClient = (c: FormClient) => {
    patch({
      clientId: c.id,
      clientLabel: c.name,
      vehicleId: null,
      vehicleLabel: "",
      clientName: "",
      clientPhone: "",
    });
    setClientSheet(false);
  };

  const selectVehicle = (v: FormVehicle) => {
    patch({
      vehicleId: v.id,
      vehicleLabel: [v.make, v.model, v.plate].filter(Boolean).join(" "),
    });
    setVehicleSheet(false);
  };

  const addManualWork = () => {
    const title = manualWork.title.trim();
    if (!title) return;
    patch({
      works: [
        ...form.works,
        {
          key: nextKey(),
          title,
          qty: "1",
          price: manualWork.price.trim() || "0",
          executors: [],
          contractors: [],
        },
      ],
    });
    setManualWork({ title: "", price: "" });
    setWorkSheet(false);
  };

  const addCatalogWork = (w: CatalogWork) => {
    patch({
      works: [
        ...form.works,
        {
          key: nextKey(),
          catalog_work_id: w.id,
          title: w.name,
          qty: "1",
          price: String(w.default_unit_price ?? 0),
          executors: [],
          contractors: [],
        },
      ],
    });
    setWorkSheet(false);
  };

  const updateWork = (key: number, p: Partial<WorkLine>) =>
    patch({
      works: form.works.map((w) => (w.key === key ? { ...w, ...p } : w)),
    });

  const removeWork = (key: number) =>
    patch({ works: form.works.filter((w) => w.key !== key) });

  const addNamedLine = (kind: "clientParts" | "shopParts" | "deliveries") => {
    const title = partForm.title.trim();
    if (!title) return;
    if (kind === "clientParts") {
      patch({
        clientParts: [
          ...form.clientParts,
          {
            key: nextKey(),
            title,
            qty: partForm.qty.trim() || "1",
            unit: partForm.unit,
          },
        ],
      });
    } else if (kind === "shopParts") {
      patch({
        shopParts: [
          ...form.shopParts,
          {
            key: nextKey(),
            title,
            qty: partForm.qty.trim() || "1",
            unit: partForm.unit,
            price: partForm.price.trim() || "0",
            markup: partForm.markup.trim(),
          },
        ],
      });
    } else {
      patch({
        deliveries: [
          ...form.deliveries,
          { key: nextKey(), title, price: partForm.price.trim() || "0" },
        ],
      });
    }
    setPartForm({ title: "", qty: "1", unit: "pcs", price: "", markup: "" });
    setPartSheet(null);
  };

  const removeLine = (
    kind: "clientParts" | "shopParts" | "deliveries",
    key: number,
  ) => {
    if (kind === "clientParts")
      patch({ clientParts: form.clientParts.filter((l) => l.key !== key) });
    else if (kind === "shopParts")
      patch({ shopParts: form.shopParts.filter((l) => l.key !== key) });
    else patch({ deliveries: form.deliveries.filter((l) => l.key !== key) });
  };

  const editWork = form.works.find((w) => w.key === editWorkKey) ?? null;

  // --- Итоги (примерные, сервер пересчитает) ---

  const totals = useMemo(() => {
    const works = form.works.reduce((s, w) => s + num(w.qty) * num(w.price), 0);
    const parts = form.shopParts.reduce((s, p) => {
      const markup = num(p.markup) > 0 ? num(p.markup) : 5;
      return s + num(p.qty) * num(p.price) * (1 + markup / 100);
    }, 0);
    const deliveries = form.deliveries.reduce((s, d) => s + num(d.price), 0);
    return { works, parts, deliveries, sum: works + parts + deliveries };
  }, [form.works, form.shopParts, form.deliveries]);

  // --- Отправка ---

  const submit = async (skipConflictCheck = false) => {
    if (saving) return;
    if (!form.clientId && form.clientName.trim().length < 2) {
      show("Укажите клиента", "error");
      setClientSheet(true);
      return;
    }
    const scheduledAt = combineDateTime(form.scheduledDate, form.scheduledTime);
    if (!scheduledAt) {
      show("Укажите дату начала", "error");
      return;
    }
    if (!skipConflictCheck && form.zoneId != null) {
      try {
        const found = await fetchPlannerConflicts({
          workZoneId: form.zoneId,
          start: scheduledAt,
          end: combineDateTime(form.endDate, form.endTime),
          excludeOrderId: orderId,
        });
        if (found.length > 0) {
          setConflicts(found);
          return;
        }
      } catch {
        /* проверка конфликтов — best effort, сервер всё равно примет */
      }
    }
    setSaving(true);
    try {
      const payload = {
        client_id: form.clientId,
        vehicle_id: form.vehicleId,
        client_name: form.clientId ? null : form.clientName.trim() || null,
        client_phone: form.clientId ? null : form.clientPhone.trim() || null,
        vehicle_make: form.vehicleId ? null : form.vehicleMake.trim() || null,
        vehicle_model: form.vehicleId ? null : form.vehicleModel.trim() || null,
        scheduled_at: scheduledAt,
        scheduled_end_at: combineDateTime(form.endDate, form.endTime),
        inspection_scheduled_at: combineDateTime(
          form.inspectionDate,
          form.inspectionTime,
        ),
        mileage_km: form.mileage.trim() ? num(form.mileage) : null,
        client_comment: form.clientComment.trim() || null,
        staff_comment: form.staffComment.trim() || null,
        work_zone_id: form.zoneId,
        discount_percent: form.discount.trim() ? num(form.discount) : null,
        works: form.works.map((w) => ({
          title: w.title.trim(),
          catalog_work_id: w.catalog_work_id ?? null,
          qty: Math.max(1, Math.round(num(w.qty) || 1)),
          unit_price: num(w.price),
          executors: w.executors
            .filter((e) => e.employee_id && num(e.percent) > 0)
            .map((e) => ({
              employee_id: e.employee_id,
              percent: num(e.percent),
            })),
          contractors: w.contractors
            .filter((c) => c.contractor_id && num(c.amount) > 0)
            .map((c) => ({
              contractor_id: c.contractor_id,
              amount: num(c.amount),
            })),
        })),
        client_parts: form.clientParts.map((p) => ({
          title: p.title.trim(),
          qty: Math.max(1, Math.round(num(p.qty) || 1)),
          unit: p.unit,
        })),
        shop_parts: form.shopParts.map((p) => ({
          ...(p.id ? { id: p.id } : {}),
          title: p.title.trim(),
          qty: Math.max(0.001, num(p.qty) || 1),
          unit: p.unit,
          unit_price: num(p.price),
          markup_percent: num(p.markup) > 0 ? num(p.markup) : undefined,
          source: "manual" as const,
        })),
        deliveries: form.deliveries.map((d) => ({
          title: d.title.trim(),
          price: num(d.price),
        })),
      };
      const saved = isEdit
        ? await updateOrder(orderId as number, payload)
        : await createOrder(payload);
      await clearOrderDraft(draftKey);
      show(isEdit ? "Заказ-наряд сохранён" : "Заказ-наряд создан", "success");
      navigation.replace("OrderDetail", { id: saved.id });
    } catch (e) {
      show(describeError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!hydrated) {
    return (
      <Screen>
        <Text style={{ color: colors.inkMuted }}>Загрузка…</Text>
      </Screen>
    );
  }

  const clientTitle = form.clientLabel || form.clientName || "Не выбран";
  const vehicleTitle =
    form.vehicleLabel ||
    [form.vehicleMake, form.vehicleModel].filter(Boolean).join(" ") ||
    "Не выбран";

  return (
    <Screen>
      <AppHeader title={isEdit ? "Редактирование заказа" : "Новый заказ-наряд"} />
      {/* Клиент */}
      <SectionTitle>Клиент</SectionTitle>
      <Pressable
        onPress={() => setClientSheet(true)}
        className="mb-3 flex-row items-center justify-between rounded-xl p-3"
        style={cardChrome(colors)}
      >
        <View className="min-w-0 flex-1">
          <Text
            className="text-sm font-medium"
            style={{ color: colors.ink }}
            numberOfLines={1}
          >
            {clientTitle}
          </Text>
          {form.clientPhone ? (
            <Text className="text-xs" style={{ color: colors.inkMuted }}>
              {form.clientPhone}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
      </Pressable>
      {!form.clientId ? (
        <View className="mb-3 gap-3">
          <TextField
            label="Имя клиента"
            value={form.clientName}
            onChangeText={(v) => patch({ clientName: v })}
            placeholder="Иван Иванов"
          />
          <TextField
            label="Телефон"
            value={form.clientPhone}
            onChangeText={(v) => patch({ clientPhone: v })}
            placeholder="+7 …"
            keyboardType="phone-pad"
          />
        </View>
      ) : null}

      {/* Автомобиль */}
      <SectionTitle>Автомобиль</SectionTitle>
      {form.clientId ? (
        <Pressable
          onPress={() => setVehicleSheet(true)}
          className="mb-3 flex-row items-center justify-between rounded-xl p-3"
          style={cardChrome(colors)}
        >
          <Text
            className="flex-1 text-sm font-medium"
            style={{ color: colors.ink }}
            numberOfLines={1}
          >
            {vehicleTitle}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
        </Pressable>
      ) : (
        <View className="mb-3 gap-3">
          <TextField
            label="Марка"
            value={form.vehicleMake}
            onChangeText={(v) => patch({ vehicleMake: v })}
            placeholder="Toyota"
          />
          <TextField
            label="Модель"
            value={form.vehicleModel}
            onChangeText={(v) => patch({ vehicleModel: v })}
            placeholder="Camry"
          />
        </View>
      )}

      {/* Даты и зона */}
      <SectionTitle>Даты и зона</SectionTitle>
      <View className="mb-3 gap-3">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DateField
              label="Дата начала"
              value={form.scheduledDate}
              onChangeText={(v) => patch({ scheduledDate: v })}
            />
          </View>
          <View className="w-28">
            <FieldLabel>Время</FieldLabel>
            <TextInput
              value={form.scheduledTime}
              onChangeText={(v) => patch({ scheduledTime: v })}
              placeholder="09:00"
              placeholderTextColor={colors.inkFaint}
              keyboardType="numbers-and-punctuation"
              className="rounded-xl px-3 py-3 text-base"
              style={inputChrome(colors)}
            />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DateField
              label="Дата конца (необяз.)"
              value={form.endDate}
              onChangeText={(v) => patch({ endDate: v })}
            />
          </View>
          <View className="w-28">
            <FieldLabel>Время</FieldLabel>
            <TextInput
              value={form.endTime}
              onChangeText={(v) => patch({ endTime: v })}
              placeholder="18:00"
              placeholderTextColor={colors.inkFaint}
              keyboardType="numbers-and-punctuation"
              className="rounded-xl px-3 py-3 text-base"
              style={inputChrome(colors)}
            />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DateField
              label="Дата записи на осмотр (необяз.)"
              value={form.inspectionDate}
              onChangeText={(v) => patch({ inspectionDate: v })}
            />
          </View>
          <View className="w-28">
            <FieldLabel>Время</FieldLabel>
            <TextInput
              value={form.inspectionTime}
              onChangeText={(v) => patch({ inspectionTime: v })}
              placeholder="14:00"
              placeholderTextColor={colors.inkFaint}
              keyboardType="numbers-and-punctuation"
              className="rounded-xl px-3 py-3 text-base"
              style={inputChrome(colors)}
            />
          </View>
        </View>
        <TextField
          label="Пробег, км"
          value={form.mileage}
          onChangeText={(v) => patch({ mileage: v })}
          keyboardType="numeric"
        />
        <FieldLabel>Рабочая зона</FieldLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
        >
          <Chip
            label="Не назначено"
            active={form.zoneId === null}
            onPress={() => patch({ zoneId: null })}
          />
          {zones.map((z) => (
            <Chip
              key={z.id}
              label={z.name}
              active={form.zoneId === z.id}
              onPress={() => patch({ zoneId: z.id })}
            />
          ))}
        </ScrollView>
        <TextField
          label={`Скидка, % (НДС ${vatRate}%)`}
          value={form.discount}
          onChangeText={(v) => patch({ discount: v })}
          keyboardType="numeric"
        />
      </View>

      {/* Работы */}
      <SectionTitle>Работы · {formatMoney(totals.works)}</SectionTitle>
      {form.works.map((w) => (
        <LineRow
          key={w.key}
          title={w.title}
          subtitle={`${w.qty} × ${formatMoney(num(w.price))}${
            w.executors.length || w.contractors.length
              ? ` · ${w.executors.length} исп., ${w.contractors.length} подп.`
              : ""
          }`}
          right={formatMoney(num(w.qty) * num(w.price))}
          onPress={() => setEditWorkKey(w.key)}
          onDelete={() => removeWork(w.key)}
        />
      ))}
      <AddButton label="Добавить работу" onPress={() => setWorkSheet(true)} />

      {/* Запчасти клиента */}
      <SectionTitle>Запчасти клиента</SectionTitle>
      {form.clientParts.map((p) => (
        <LineRow
          key={p.key}
          title={p.title}
          subtitle={`${p.qty} ${p.unit === "pcs" ? "шт" : p.unit}`}
          onDelete={() => removeLine("clientParts", p.key)}
        />
      ))}
      <AddButton
        label="Добавить запчасть клиента"
        onPress={() => {
          setPartForm({
            title: "",
            qty: "1",
            unit: "pcs",
            price: "",
            markup: "",
          });
          setPartSheet("client");
        }}
      />

      {/* Запчасти исполнителя */}
      <SectionTitle>
        Запчасти исполнителя · {formatMoney(totals.parts)}
      </SectionTitle>
      {form.shopParts.map((p) => (
        <LineRow
          key={p.key}
          title={p.title}
          subtitle={`${p.qty} ${p.unit === "pcs" ? "шт" : p.unit} × ${formatMoney(num(p.price))}`}
          right={formatMoney(
            num(p.qty) *
              num(p.price) *
              (1 + (num(p.markup) > 0 ? num(p.markup) : 5) / 100),
          )}
          onDelete={() => removeLine("shopParts", p.key)}
        />
      ))}
      <AddButton
        label="Добавить запчасть исполнителя"
        onPress={() => {
          setPartForm({
            title: "",
            qty: "1",
            unit: "pcs",
            price: "",
            markup: "",
          });
          setPartSheet("shop");
        }}
      />

      {/* Доставки */}
      <SectionTitle>Доставки · {formatMoney(totals.deliveries)}</SectionTitle>
      {form.deliveries.map((d) => (
        <LineRow
          key={d.key}
          title={d.title}
          right={formatMoney(num(d.price))}
          onDelete={() => removeLine("deliveries", d.key)}
        />
      ))}
      <AddButton
        label="Добавить доставку"
        onPress={() => {
          setPartForm({
            title: "",
            qty: "1",
            unit: "pcs",
            price: "",
            markup: "",
          });
          setPartSheet("delivery");
        }}
      />

      {/* Комментарии */}
      <SectionTitle>Комментарии</SectionTitle>
      <TextField
        label="Комментарий клиента"
        value={form.clientComment}
        onChangeText={(v) => patch({ clientComment: v })}
        multiline
      />
      <TextField
        label="Внутренний комментарий"
        value={form.staffComment}
        onChangeText={(v) => patch({ staffComment: v })}
        multiline
      />

      {/* Итог и кнопка */}
      <View
        className="mt-2 flex-row items-center justify-between rounded-xl p-4"
        style={cardChrome(colors)}
      >
        <Text className="text-sm" style={{ color: colors.inkMuted }}>
          Примерная сумма
        </Text>
        <Text className="text-lg font-bold" style={{ color: colors.ink }}>
          {formatMoney(totals.sum)}
        </Text>
      </View>
      <Button
        title={
          saving
            ? "Сохранение…"
            : isEdit
              ? "Сохранить изменения"
              : "Создать заказ-наряд"
        }
        loading={saving}
        className="mt-3"
        onPress={() => void submit()}
      />
      <View className="h-8" />

      {/* Шторка: клиент */}
      <PickerSheet
        visible={clientSheet}
        title="Выбор клиента"
        onClose={() => setClientSheet(false)}
      >
        <TextInput
          value={clientQuery}
          onChangeText={setClientQuery}
          placeholder="Поиск по имени или телефону"
          placeholderTextColor={colors.inkFaint}
          className="mb-3 rounded-xl px-4 py-3 text-base"
          style={inputChrome(colors)}
        />
        {clients.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => selectClient(c)}
            className="mb-2 rounded-xl p-3"
            style={cardChrome(colors)}
          >
            <Text className="text-sm font-medium" style={{ color: colors.ink }}>
              {c.name}
            </Text>
            <Text className="text-xs" style={{ color: colors.inkMuted }}>
              {c.phone || "—"}
            </Text>
          </Pressable>
        ))}
        <View className="mt-2 gap-2">
          <TextField
            label="Или новый клиент"
            value={newClientName}
            onChangeText={setNewClientName}
            placeholder="Имя"
          />
          <TextField
            value={newClientPhone}
            onChangeText={setNewClientPhone}
            placeholder="Телефон"
            keyboardType="phone-pad"
          />
          <Button
            title={creatingClient ? "Создание…" : "Создать клиента"}
            loading={creatingClient}
            disabled={newClientName.trim().length < 2}
            onPress={() => {
              setCreatingClient(true);
              void createClient({
                name: newClientName.trim(),
                phone: newClientPhone.trim() || undefined,
              })
                .then((c) => {
                  selectClient(c);
                  setNewClientName("");
                  setNewClientPhone("");
                })
                .catch((e) => show(describeError(e), "error"))
                .finally(() => setCreatingClient(false));
            }}
          />
        </View>
      </PickerSheet>

      {/* Шторка: автомобиль */}
      <PickerSheet
        visible={vehicleSheet}
        title="Выбор автомобиля"
        onClose={() => setVehicleSheet(false)}
      >
        {vehicles.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => selectVehicle(v)}
            className="mb-2 rounded-xl p-3"
            style={cardChrome(colors)}
          >
            <Text className="text-sm font-medium" style={{ color: colors.ink }}>
              {[v.make, v.model].filter(Boolean).join(" ")}
              {v.plate ? ` · ${v.plate}` : ""}
            </Text>
            {v.year ? (
              <Text className="text-xs" style={{ color: colors.inkMuted }}>
                {v.year}
                {v.vin ? ` · VIN ${v.vin}` : ""}
              </Text>
            ) : null}
          </Pressable>
        ))}
        <View className="mt-2 gap-2">
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Новый автомобиль
          </Text>
          <TextField
            label="Марка"
            value={newVehicle.make}
            onChangeText={(v) => setNewVehicle((p) => ({ ...p, make: v }))}
            placeholder="Toyota"
          />
          <TextField
            label="Модель"
            value={newVehicle.model}
            onChangeText={(v) => setNewVehicle((p) => ({ ...p, model: v }))}
            placeholder="Camry"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextField
                label="Год"
                value={newVehicle.year}
                onChangeText={(v) => setNewVehicle((p) => ({ ...p, year: v }))}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Госномер"
                value={newVehicle.plate}
                onChangeText={(v) => setNewVehicle((p) => ({ ...p, plate: v }))}
                placeholder="А123БВ77"
              />
            </View>
          </View>
          <Button
            title={creatingVehicle ? "Создание…" : "Добавить автомобиль"}
            loading={creatingVehicle}
            disabled={!newVehicle.make.trim() || !form.clientId}
            onPress={() => {
              if (!form.clientId) return;
              setCreatingVehicle(true);
              void createVehicle({
                client_id: form.clientId,
                make: newVehicle.make.trim(),
                model: newVehicle.model.trim() || undefined,
                year: newVehicle.year.trim() ? num(newVehicle.year) : null,
                plate: newVehicle.plate.trim() || undefined,
              })
                .then((v) => {
                  selectVehicle(v);
                  setNewVehicle({ make: "", model: "", year: "", plate: "" });
                })
                .catch((e) => show(describeError(e), "error"))
                .finally(() => setCreatingVehicle(false));
            }}
          />
        </View>
      </PickerSheet>

      {/* Шторка: работа */}
      <PickerSheet
        visible={workSheet}
        title="Добавить работу"
        onClose={() => setWorkSheet(false)}
      >
        <TextInput
          value={workQuery}
          onChangeText={setWorkQuery}
          placeholder="Поиск по каталогу работ"
          placeholderTextColor={colors.inkFaint}
          className="mb-3 rounded-xl px-4 py-3 text-base"
          style={inputChrome(colors)}
        />
        {catalogWorks.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => addCatalogWork(w)}
            className="mb-2 flex-row items-center justify-between rounded-xl p-3"
            style={cardChrome(colors)}
          >
            <Text
              className="flex-1 text-sm"
              style={{ color: colors.ink }}
              numberOfLines={1}
            >
              {w.name}
            </Text>
            <Text className="ml-2 text-xs" style={{ color: colors.inkMuted }}>
              {formatMoney(w.default_unit_price)}
            </Text>
          </Pressable>
        ))}
        <View className="mt-2 gap-2">
          <Text
            className="text-xs font-semibold uppercase"
            style={{ color: colors.inkMuted }}
          >
            Своя работа
          </Text>
          <TextField
            label="Название"
            value={manualWork.title}
            onChangeText={(v) => setManualWork((p) => ({ ...p, title: v }))}
            placeholder="Замена детали"
          />
          <TextField
            label="Цена"
            value={manualWork.price}
            onChangeText={(v) => setManualWork((p) => ({ ...p, price: v }))}
            keyboardType="numeric"
          />
          <Button
            title="Добавить"
            disabled={!manualWork.title.trim()}
            onPress={addManualWork}
          />
        </View>
      </PickerSheet>

      {/* Шторка: редактирование работы (исполнители/подрядчики) */}
      <PickerSheet
        visible={editWork != null}
        title={editWork?.title ?? "Работа"}
        onClose={() => setEditWorkKey(null)}
      >
        {editWork ? (
          <View>
            <View className="mb-3 flex-row gap-2">
              <View className="flex-1">
                <TextField
                  label="Кол-во"
                  value={editWork.qty}
                  onChangeText={(v) => updateWork(editWork.key, { qty: v })}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <TextField
                  label="Цена"
                  value={editWork.price}
                  onChangeText={(v) => updateWork(editWork.key, { price: v })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text
              className="mb-1 text-xs font-semibold uppercase"
              style={{ color: colors.inkMuted }}
            >
              Исполнители (процент от суммы работы)
            </Text>
            {employees.map((emp) => {
              const ex = editWork.executors.find(
                (e) => e.employee_id === emp.id,
              );
              return (
                <View
                  key={emp.id}
                  className="mb-2 flex-row items-center gap-2 rounded-lg p-2.5"
                  style={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <Pressable
                    onPress={() =>
                      updateWork(editWork.key, {
                        executors: ex
                          ? editWork.executors.filter(
                              (e) => e.employee_id !== emp.id,
                            )
                          : [
                              ...editWork.executors,
                              {
                                employee_id: emp.id,
                                percent: String(emp.work_percent ?? ""),
                              },
                            ],
                      })
                    }
                    className="h-5 w-5 items-center justify-center rounded"
                    style={{
                      backgroundColor: ex ? colors.brand : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    {ex ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : null}
                  </Pressable>
                  <Text
                    className="flex-1 text-sm"
                    style={{ color: colors.ink }}
                    numberOfLines={1}
                  >
                    {emp.name}
                  </Text>
                  {ex ? (
                    <TextInput
                      value={ex.percent}
                      onChangeText={(v) =>
                        updateWork(editWork.key, {
                          executors: editWork.executors.map((e) =>
                            e.employee_id === emp.id ? { ...e, percent: v } : e,
                          ),
                        })
                      }
                      keyboardType="numeric"
                      className="w-16 rounded-lg px-2 py-1.5 text-right text-sm"
                      style={{
                        backgroundColor: colors.surface,
                        color: colors.ink,
                      }}
                    />
                  ) : null}
                  {ex ? (
                    <Text
                      className="text-xs"
                      style={{ color: colors.inkMuted }}
                    >
                      %
                    </Text>
                  ) : null}
                </View>
              );
            })}

            <Text
              className="mb-1 mt-3 text-xs font-semibold uppercase"
              style={{ color: colors.inkMuted }}
            >
              Подрядчики (фикс. сумма)
            </Text>
            {contractors.map((c) => {
              const ct = editWork.contractors.find(
                (x) => x.contractor_id === c.id,
              );
              return (
                <View
                  key={c.id}
                  className="mb-2 flex-row items-center gap-2 rounded-lg p-2.5"
                  style={{ backgroundColor: colors.surfaceSubtle }}
                >
                  <Pressable
                    onPress={() =>
                      updateWork(editWork.key, {
                        contractors: ct
                          ? editWork.contractors.filter(
                              (x) => x.contractor_id !== c.id,
                            )
                          : [
                              ...editWork.contractors,
                              { contractor_id: c.id, amount: "" },
                            ],
                      })
                    }
                    className="h-5 w-5 items-center justify-center rounded"
                    style={{
                      backgroundColor: ct ? colors.brand : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    {ct ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : null}
                  </Pressable>
                  <Text
                    className="flex-1 text-sm"
                    style={{ color: colors.ink }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {ct ? (
                    <TextInput
                      value={ct.amount}
                      onChangeText={(v) =>
                        updateWork(editWork.key, {
                          contractors: editWork.contractors.map((x) =>
                            x.contractor_id === c.id ? { ...x, amount: v } : x,
                          ),
                        })
                      }
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.inkFaint}
                      className="w-20 rounded-lg px-2 py-1.5 text-right text-sm"
                      style={{
                        backgroundColor: colors.surface,
                        color: colors.ink,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </PickerSheet>

      {/* Шторка: добавление позиции */}
      <PickerSheet
        visible={partSheet != null}
        title={
          partSheet === "client"
            ? "Запчасть клиента"
            : partSheet === "shop"
              ? "Запчасть исполнителя"
              : "Доставка"
        }
        onClose={() => setPartSheet(null)}
      >
        <TextField
          label="Название"
          value={partForm.title}
          onChangeText={(v) => setPartForm((p) => ({ ...p, title: v }))}
          placeholder="Фильтр масляный"
        />
        {partSheet !== "delivery" ? (
          <View className="mb-3 flex-row gap-2">
            <View className="flex-1">
              <TextField
                label="Кол-во"
                value={partForm.qty}
                onChangeText={(v) => setPartForm((p) => ({ ...p, qty: v }))}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <FieldLabel>Ед.</FieldLabel>
              <View className="flex-row gap-1">
                {(["pcs", "l", "kg"] as const).map((u) => (
                  <View key={u} className="flex-1">
                    <Chip
                      label={u === "pcs" ? "шт" : u}
                      active={partForm.unit === u}
                      onPress={() => setPartForm((p) => ({ ...p, unit: u }))}
                    />
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
        {partSheet !== "client" ? (
          <>
            <TextField
              label={partSheet === "shop" ? "Цена закупки" : "Стоимость"}
              value={partForm.price}
              onChangeText={(v) => setPartForm((p) => ({ ...p, price: v }))}
              keyboardType="numeric"
            />
            {partSheet === "shop" ? (
              <TextField
                label="Наценка, % (пусто = 5%)"
                value={partForm.markup}
                onChangeText={(v) => setPartForm((p) => ({ ...p, markup: v }))}
                keyboardType="numeric"
              />
            ) : null}
          </>
        ) : null}
        <Button
          title="Добавить"
          disabled={!partForm.title.trim()}
          onPress={() =>
            addNamedLine(
              partSheet === "client"
                ? "clientParts"
                : partSheet === "shop"
                  ? "shopParts"
                  : "deliveries",
            )
          }
        />
      </PickerSheet>

      <ConfirmDialog
        visible={conflicts != null}
        title="Конфликт в планировщике"
        message={
          conflicts && conflicts.length > 0
            ? `В это время в выбранной зоне уже есть записи:\n${conflicts
                .slice(0, 5)
                .map(
                  (c) =>
                    `• ${c.client_name}${c.order_number ? ` (№${c.order_number})` : ""} — ${formatTime(c.scheduled_at)}`,
                )
                .join("\n")}\n\nСохранить всё равно?`
            : ""
        }
        confirmLabel="Сохранить"
        onConfirm={() => {
          setConflicts(null);
          void submit(true);
        }}
        onCancel={() => setConflicts(null)}
      />
    </Screen>
  );
}
