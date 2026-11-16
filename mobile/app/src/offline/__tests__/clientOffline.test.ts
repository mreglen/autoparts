import { beforeEach, describe, expect, it } from "@jest/globals";

import { ApiError } from "../../api/errors";
import { cachedGet, invalidateEntities, setCacheStore } from "../cache";
import { policyForPath } from "../policies";
import { createMemoryStore } from "../store";

const offlineFetcher = <T>(): Promise<T> =>
  Promise.reject(new ApiError("network", 0, null));

/** Этап 31: клиентский контур читается офлайн там, где политика разрешает. */
describe("offline cache — клиентский контур", () => {
  beforeEach(() => {
    setCacheStore(createMemoryStore());
  });

  it("клиентские пути покрыты политиками актуальности", () => {
    const cases: [string, string][] = [
      ["/autoservice/clients/me/orgs", "clients"],
      ["/autoservice/clients/me", "clients"],
      ["/autoservice/inspection-bookings/me", "bookings"],
      ["/autoservice/repair-orders/me?scope=all", "repair-orders"],
      ["/autoservice/repair-orders/me/42", "repair-orders"],
      ["/autoservice/garage/vehicles?organization_id=org1", "garage-vehicles"],
      ["/public/autoservice/organizations", "public-autoservice-orgs"],
      ["/api/notifications/feed?limit=50", "notifications"],
    ];
    for (const [path, entity] of cases) {
      expect(policyForPath(path)?.entity).toBe(entity);
    }
  });

  it("гараж и история отдаются из кэша без сети с пометкой stale", async () => {
    const garage = "/autoservice/garage/vehicles?organization_id=org1";
    const history = "/autoservice/repair-orders/me?scope=all";
    await cachedGet(garage, async () => [{ id: 1, make: "Toyota" }]);
    await cachedGet(history, async () => [{ id: 7, order_number: "3" }]);

    const g = await cachedGet(garage, offlineFetcher);
    const h = await cachedGet(history, offlineFetcher);
    expect(g.fromCache).toBe(true);
    expect(g.stale).toBe(true);
    expect(h.fromCache).toBe(true);
    expect(h.stale).toBe(true);
  });

  it("записи на осмотр читаются офлайн, мутация инвалидирует список", async () => {
    const bookings = "/autoservice/inspection-bookings/me";
    await cachedGet(bookings, async () => [{ id: 1, status: "new" }]);

    const cached = await cachedGet(bookings, offlineFetcher);
    expect(cached.fromCache).toBe(true);

    await invalidateEntities(["bookings"]);
    await expect(cachedGet(bookings, offlineFetcher)).rejects.toThrow(ApiError);
  });

  it("уведомления и публичный справочник СТО тоже офлайн-доступны", async () => {
    const feed = "/api/notifications/feed?limit=50";
    const orgs = "/public/autoservice/organizations";
    await cachedGet(feed, async () => ({ items: [], unread_count: 0 }));
    await cachedGet(orgs, async () => [{ organization_id: "o1" }]);

    expect((await cachedGet(feed, offlineFetcher)).fromCache).toBe(true);
    expect((await cachedGet(orgs, offlineFetcher)).fromCache).toBe(true);
  });

  it("клиентские карточки (/clients/me) офлайн-доступны", async () => {
    const me = "/autoservice/clients/me";
    await cachedGet(me, async () => ({ cards: [] }));
    const result = await cachedGet(me, offlineFetcher);
    expect(result.fromCache).toBe(true);
    expect(result.stale).toBe(true);
  });
});
