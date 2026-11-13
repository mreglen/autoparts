import { beforeEach, describe, expect, it } from "@jest/globals";

import { ApiError } from "../../api/errors";
import { cachedGet, invalidateEntities, setCacheStore } from "../cache";
import { pendingMigrations, CACHE_MIGRATIONS } from "../migrations";
import { policyForPath } from "../policies";
import { createMemoryStore, selectEvictionKeys } from "../store";

const offlineFetcher = <T>(): Promise<T> =>
  Promise.reject(new ApiError("network", 0, null));

describe("offline cache", () => {
  beforeEach(() => {
    setCacheStore(createMemoryStore());
  });

  it("сохраняет ответ и отдаёт его из кэша при сетевой ошибке", async () => {
    const path = "/autoservice/repair-orders?page=1";
    const first = await cachedGet(path, async () => ({ items: [1, 2] }));
    expect(first.fromCache).toBe(false);
    expect(first.stale).toBe(false);

    const second = await cachedGet(path, offlineFetcher);
    expect(second.fromCache).toBe(true);
    expect(second.stale).toBe(true);
    expect(second.data).toEqual({ items: [1, 2] });
    expect(second.fetchedAt).toBe(first.fetchedAt);
  });

  it("не отдаёт кэш для сущности, запрещённой к показу без сети", async () => {
    const path = "/autoservice/finance/payments";
    await cachedGet(path, async () => ({ total: 100 }));
    await expect(cachedGet(path, offlineFetcher)).rejects.toThrow(ApiError);
  });

  it("не кэширует пути без политики", async () => {
    const path = "/autoservice/unknown-thing";
    expect(policyForPath(path)).toBeUndefined();
    const result = await cachedGet(path, async () => ({ ok: true }));
    expect(result.fromCache).toBe(false);
  });

  it("пробрасывает http-ошибки без обращения к кэшу", async () => {
    const path = "/autoservice/repair-orders";
    await cachedGet(path, async () => ({ items: [] }));
    const httpError = new ApiError("http", 500, "boom");
    await expect(
      cachedGet(path, async () => Promise.reject(httpError)),
    ).rejects.toThrow(httpError);
  });

  it("инвалидирует сущность после мутации", async () => {
    const list = "/autoservice/repair-orders";
    const detail = "/autoservice/repair-orders/42";
    await cachedGet(list, async () => ({ items: ["a"] }));
    await cachedGet(detail, async () => ({ id: 42 }));
    await invalidateEntities(["repair-orders"]);

    // После инвалидации офлайн-ответа нет — ошибка сети пробрасывается.
    await expect(cachedGet(list, offlineFetcher)).rejects.toThrow(ApiError);
    await expect(cachedGet(detail, offlineFetcher)).rejects.toThrow(ApiError);
  });

  it("выбирает самую длинную политику по префиксу", () => {
    expect(policyForPath("/autoservice/finance/payments/9")?.entity).toBe(
      "finance-payments",
    );
    expect(policyForPath("/autoservice/repair-orders/1/items")?.entity).toBe(
      "repair-orders",
    );
  });

  it("пустое хранилище при первом запуске отдаёт null", async () => {
    const store = createMemoryStore();
    await expect(store.get("nothing")).resolves.toBeNull();
    await expect(store.listAll()).resolves.toEqual([]);
  });

  it("вытесняет самые старые не-gorячие записи при переполнении", () => {
    const entries = [
      {
        key: "hot-old",
        entity: "repair-orders",
        payload: "x".repeat(10),
        fetchedAt: 1,
      },
      {
        key: "cold-old",
        entity: "reports",
        payload: "x".repeat(10),
        fetchedAt: 2,
      },
      {
        key: "cold-new",
        entity: "reports",
        payload: "x".repeat(10),
        fetchedAt: 3,
      },
    ];
    const evicted = selectEvictionKeys(
      entries,
      { maxEntries: 2, maxPayloadChars: 1000 },
      new Set(["repair-orders"]),
    );
    expect(evicted).toEqual(["cold-old"]);
  });

  it("миграции применяются по порядку и только один раз", () => {
    expect(pendingMigrations([])).toEqual(CACHE_MIGRATIONS);
    expect(pendingMigrations([1])).toEqual([]);
    expect(pendingMigrations([CACHE_MIGRATIONS[0].version])).toEqual([]);
  });
});
