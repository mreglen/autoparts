/** Реестр актуальности кэша — таблица этапа 3.
 *  Документ: mobile/docs/stages/03-offline.md — держать в синхроне. */

export interface CachePolicy {
  /** Сущность для инвалидации после мутаций (например 'repair-orders'). */
  entity: string;
  /** Префикс пути API без query; выбирается самое длинное совпадение. */
  pathPrefix: string;
  /** Через сколько мс запись считается протухшей (влияет на флаг stale при онлайне). */
  ttlMs: number;
  /** Разрешено ли показывать запись без сети. false — только свежие данные с сервера. */
  offlineReadable: boolean;
  /** Горячие сущности вытеснение щадит дольше остальных. */
  hot?: boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const CACHE_POLICIES: CachePolicy[] = [
  // --- Сегодня / дашборд ---
  {
    entity: "dashboard",
    pathPrefix: "/autoservice/dashboard",
    ttlMs: 5 * MIN,
    offlineReadable: true,
    hot: true,
  },
  // --- Записи на осмотр ---
  {
    entity: "bookings",
    pathPrefix: "/autoservice/inspections",
    ttlMs: 10 * MIN,
    offlineReadable: true,
    hot: true,
  },
  {
    entity: "bookings",
    pathPrefix: "/autoservice/inspection-bookings",
    ttlMs: 10 * MIN,
    offlineReadable: true,
    hot: true,
  },
  {
    entity: "bookings",
    pathPrefix: "/autoservice/bookings",
    ttlMs: 10 * MIN,
    offlineReadable: true,
    hot: true,
  },
  // --- Заказ-наряды ---
  {
    entity: "repair-orders",
    pathPrefix: "/autoservice/repair-orders",
    ttlMs: 10 * MIN,
    offlineReadable: true,
    hot: true,
  },
  // --- Планировщик ---
  {
    entity: "planner",
    pathPrefix: "/autoservice/planner",
    ttlMs: 10 * MIN,
    offlineReadable: true,
    hot: true,
  },
  // --- Склад ---
  {
    entity: "warehouse",
    pathPrefix: "/autoservice/warehouse",
    ttlMs: 15 * MIN,
    offlineReadable: true,
  },
  {
    entity: "warehouse-items",
    pathPrefix: "/autoservice/warehouse-items",
    ttlMs: 15 * MIN,
    offlineReadable: true,
  },
  // --- Финансы: списки читаем офлайн, но без статусов оплаты «в моменте» ---
  {
    entity: "finance-transactions",
    pathPrefix: "/autoservice/finance/transactions",
    ttlMs: 15 * MIN,
    offlineReadable: true,
  },
  {
    entity: "finance-expenses",
    pathPrefix: "/autoservice/finance/expenses",
    ttlMs: 15 * MIN,
    offlineReadable: true,
  },
  {
    entity: "finance-payments",
    pathPrefix: "/autoservice/finance/payments",
    ttlMs: 5 * MIN,
    offlineReadable: false,
  },
  // --- Отчёты ---
  {
    entity: "reports",
    pathPrefix: "/autoservice/reports",
    ttlMs: HOUR,
    offlineReadable: true,
  },
  // --- Справочники ---
  {
    entity: "clients",
    pathPrefix: "/autoservice/clients",
    ttlMs: HOUR,
    offlineReadable: true,
  },
  {
    entity: "employees",
    pathPrefix: "/autoservice/service-employees",
    ttlMs: DAY,
    offlineReadable: true,
  },
  {
    entity: "contractors",
    pathPrefix: "/autoservice/contractors",
    ttlMs: DAY,
    offlineReadable: true,
  },
  {
    entity: "expense-articles",
    pathPrefix: "/autoservice/expense-articles",
    ttlMs: DAY,
    offlineReadable: true,
  },
  // --- Настройки/профиль ---
  {
    entity: "settings",
    pathPrefix: "/autoservice/settings",
    ttlMs: DAY,
    offlineReadable: true,
  },
  {
    entity: "meta",
    pathPrefix: "/autoservice/meta",
    ttlMs: DAY,
    offlineReadable: true,
  },
  {
    entity: "calendar-sync",
    pathPrefix: "/autoservice/calendar-sync",
    ttlMs: HOUR,
    offlineReadable: false,
  },
];

export function policyForPath(path: string): CachePolicy | undefined {
  const clean = path.split("?")[0];
  let best: CachePolicy | undefined;
  for (const policy of CACHE_POLICIES) {
    if (
      clean.startsWith(policy.pathPrefix) &&
      (!best || policy.pathPrefix.length > best.pathPrefix.length)
    ) {
      best = policy;
    }
  }
  return best;
}

/** Только для тестов: подмена/добавление политик. */
export function __registerPolicyForTest(policy: CachePolicy): void {
  CACHE_POLICIES.push(policy);
}
