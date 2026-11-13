import AsyncStorage from "@react-native-async-storage/async-storage";

/** Черновики формы заказ-наряда — тот же ключевой префикс, что на вебе
 *  (`sg:repair-order-form:*`), хранилище — AsyncStorage вместо sessionStorage. */

const PREFIX = "sg:repair-order-form:";

export interface OrderFormDraft {
  key: string;
  mode: "create" | "edit";
  orderId: number | null;
  createToken: string;
  form: Record<string, unknown>;
  savedAt: number;
}

function snapshotHasContent(form: unknown): boolean {
  if (!form || typeof form !== "object") return false;
  const f = form as Record<string, unknown>;
  if (f.clientId || f.vehicleId) return true;
  for (const k of [
    "pendingClientName",
    "pendingClientPhone",
    "pendingVehicleMake",
    "pendingVehicleModel",
    "clientName",
    "clientPhone",
    "vehicleMake",
    "vehicleModel",
    "scheduledDate",
    "inspectionDate",
    "comment",
    "staffComment",
  ]) {
    if (String(f[k] ?? "").trim()) return true;
  }
  if (f.zoneId != null || String(f.discount ?? "").trim()) return true;
  for (const k of ["works", "clientParts", "shopParts", "deliveries"]) {
    if (Array.isArray(f[k]) && (f[k] as unknown[]).length > 0) return true;
  }
  return false;
}

export function draftTitle(draft: OrderFormDraft): string {
  if (draft.mode === "edit" && draft.orderId) {
    return `Заказ-наряд #${draft.orderId}`;
  }
  const f = draft.form;
  const name =
    String(f.clientName ?? "").trim() ||
    String(f.pendingClientName ?? "").trim();
  return name ? `Новый заказ-наряд · ${name}` : "Новый заказ-наряд";
}

export async function listOrderDrafts(): Promise<OrderFormDraft[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drafts: OrderFormDraft[] = [];
    for (const key of keys) {
      if (!key.startsWith(PREFIX)) continue;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as {
          form?: Record<string, unknown>;
          savedAt?: number;
        };
        if (!parsed?.form || !snapshotHasContent(parsed.form)) continue;
        const rest = key.slice(PREFIX.length);
        const sep = rest.indexOf(":");
        const mode = sep === -1 ? rest : rest.slice(0, sep);
        const tail = sep === -1 ? "" : rest.slice(sep + 1);
        // Ключи: веб `create:<token>`, мобильный `create:new:<token>`; edit:<orderId>[:token].
        let createToken = "";
        if (mode === "create") {
          const parts = tail.split(":");
          createToken = parts[0] === "new" ? parts.slice(1).join(":") : tail;
        }
        drafts.push({
          key,
          mode: mode === "edit" ? "edit" : "create",
          orderId: mode === "edit" ? Number(tail.split(":")[0]) || null : null,
          createToken,
          form: parsed.form,
          savedAt: Number(parsed.savedAt) || 0,
        });
      } catch {
        /* skip broken entry */
      }
    }
    drafts.sort((a, b) => b.savedAt - a.savedAt);
    return drafts;
  } catch {
    return [];
  }
}

export async function readOrderDraft(
  key: string,
): Promise<OrderFormDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      form?: Record<string, unknown>;
      savedAt?: number;
    };
    if (!parsed?.form || !snapshotHasContent(parsed.form)) return null;
    return {
      key,
      mode: key.includes(":edit:") ? "edit" : "create",
      orderId: null,
      createToken: "",
      form: parsed.form,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export async function writeOrderDraft(
  key: string,
  form: Record<string, unknown>,
): Promise<void> {
  if (!snapshotHasContent(form)) {
    await clearOrderDraft(key);
    return;
  }
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ form, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

export async function clearOrderDraft(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
