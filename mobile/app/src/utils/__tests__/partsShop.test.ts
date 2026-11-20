import { describe, expect, it } from "@jest/globals";

import {
  applyMarkup,
  cartTotal,
  collectAnalogs,
  collectOfferParts,
  dedupeParts,
  formatDeliveryText,
  formatPhoneInput,
  getMinPrice,
  getStockCount,
  hasInStock,
  inStockStocks,
  isReadyForPickup,
  normalizePickupOption,
  parseSupplierPrice,
  splitOriginalAndAnalogs,
  truncateRubles,
  validateEmail,
  validateFullName,
  validatePhone,
} from "../partsShop";

function stock(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    price: "1000.50",
    count: "5",
    deliveryStart: "2025-01-10T10:00:00",
    deliveryEnd: "2025-01-10T18:00:00",
    ...over,
  };
}

function part(over: Record<string, unknown> = {}) {
  return {
    guid: "g1",
    brand: "BOSCH",
    partnumber: "0986AB1234",
    name: "Колодки тормозные",
    stocks: { stock: [stock()] },
    ...over,
  } as never;
}

describe("truncateRubles / parseSupplierPrice / applyMarkup", () => {
  it("truncates to whole rubles", () => {
    expect(truncateRubles(1000.99)).toBe(1000);
    expect(truncateRubles("999.5")).toBe(999);
    expect(truncateRubles(0)).toBe(0);
    expect(truncateRubles(-5)).toBe(0);
    expect(truncateRubles(null)).toBe(0);
  });

  it("parses supplier price", () => {
    expect(parseSupplierPrice("1234.56")).toBe(1234);
    expect(parseSupplierPrice("abc")).toBe(0);
  });

  it("applies markup with truncation", () => {
    // 1000 * 1.15 = 1150
    expect(applyMarkup("1000", 15)).toBe(1150);
    // 999 * 1.07 = 1068.93 -> 1068
    expect(applyMarkup(999, 7)).toBe(1068);
    expect(applyMarkup(0, 15)).toBe(0);
  });
});

describe("stock filtering", () => {
  it("requires delivery window for deliverable stock", () => {
    const p = part({ stocks: { stock: [stock({ deliveryEnd: null })] } });
    expect(getStockCount(p)).toBe(0);
    expect(hasInStock(p)).toBe(false);
  });

  it("filters in-stock offers", () => {
    const p = part({
      stocks: {
        stock: [
          stock({ id: 1, price: "100", count: "2" }),
          stock({ id: 2, price: "0", count: "2" }),
          stock({ id: 3, price: "100", count: "0" }),
          stock({ id: 4, price: "50", count: "1" }),
        ],
      },
    });
    const stocks = inStockStocks(p);
    expect(stocks.map((s) => s.stock_id)).toEqual(["1", "4"]);
    expect(getMinPrice(p)).toBeCloseTo(50);
    expect(getStockCount(p)).toBe(5);
  });

  it("supports snake_case delivery fields", () => {
    const p = part({
      stocks: {
        stock: [
          {
            id: 9,
            price: "10",
            count: "1",
            delivery_start: "2025-01-01T00:00:00",
            delivery_end: "2025-01-02T00:00:00",
          },
        ],
      },
    });
    expect(hasInStock(p)).toBe(true);
  });
});

describe("dedupeParts / analogs", () => {
  it("dedupes by guid and merges stocks", () => {
    const a = part({ guid: "g", stocks: { stock: [stock({ id: 1, count: "2" })] } });
    const b = part({ guid: "g", stocks: { stock: [stock({ id: 2, count: "3" })] } });
    const [merged] = dedupeParts([a, b] as never[]);
    expect(getStockCount(merged)).toBe(5);
  });

  it("collects in-stock analogs from crosses", () => {
    const p = part({
      crosses: {
        Part: [
          part({ guid: "a1", stocks: { stock: [stock()] } }),
          part({ guid: "a2", stocks: { stock: [] } }),
        ],
      },
    });
    const analogs = collectAnalogs([p] as never[]);
    expect(analogs.map((a) => a.guid)).toEqual(["a1"]);
  });

  it("collectOfferParts merges originals and analogs", () => {
    const analog = part({ guid: "an", partnumber: "OTHER", crosses: undefined });
    const p = part({
      crosses: { Part: [analog] },
      stocks: { stock: [] },
    });
    const offers = collectOfferParts([p] as never[]);
    expect(offers).toHaveLength(1);
    expect(offers[0].guid).toBe("an");
  });

  it("splits originals and analogs by query match", () => {
    const { originals, analogs } = splitOriginalAndAnalogs(
      [part(), part({ guid: "x", partnumber: "ZZ999" })] as never[],
      "0986AB1234",
    );
    expect(originals).toHaveLength(1);
    expect(analogs).toHaveLength(1);
  });
});

describe("contact validation (ported from site)", () => {
  it("validates full name", () => {
    expect(validateFullName("")).toBeTruthy();
    expect(validateFullName("Иван")).toBeTruthy();
    expect(validateFullName("Иванов Иван")).toBe("");
    expect(validateFullName("Иванов Иван Иванович")).toBe("");
    expect(validateFullName("Иванов Иван Петрович Сидорович")).toBeTruthy();
    expect(validateFullName("Ivan Ivanov")).toBeTruthy();
  });

  it("formats phone to +7 pattern", () => {
    expect(formatPhoneInput("89001234567")).toBe("+7 (900) 123-45-67");
    expect(formatPhoneInput("+79001234567")).toBe("+7 (900) 123-45-67");
    expect(formatPhoneInput("")).toBe("");
  });

  it("validates phone", () => {
    expect(validatePhone("")).toBeTruthy();
    expect(validatePhone("+7 (900) 123-45-67")).toBe("");
    expect(validatePhone("123")).toBeTruthy();
    expect(validatePhone("89001234567")).toBeTruthy();
  });

  it("validates email", () => {
    expect(validateEmail("")).toBe("");
    expect(validateEmail("a@b.co")).toBe("");
    expect(validateEmail("bad")).toBeTruthy();
    expect(validateEmail("a b@c.ru")).toBeTruthy();
  });
});

describe("delivery / misc", () => {
  it("formats delivery text", () => {
    expect(formatDeliveryText(null, null)).toBe("—");
    expect(formatDeliveryText("bad", "bad")).toBe("—");
    const text = formatDeliveryText("2025-01-10T10:00:00", "2025-01-10T18:00:00");
    expect(text).toContain("с 10:00");
  });

  it("normalizes pickup option preferring Урал", () => {
    const opts = [
      { id: 1, delivery_type: "pvz", region_name: "Москва", enabled: true },
      { id: 2, delivery_type: "pickup", region_name: "Сибирь", enabled: true },
      { id: 3, delivery_type: "pickup", region_name: "Урал", enabled: true },
    ];
    expect(normalizePickupOption(opts as never)?.id).toBe(3);
    expect(normalizePickupOption([])).toBeNull();
    expect(
      normalizePickupOption([
        { id: 4, delivery_type: "pickup", region_name: "Сибирь", enabled: false },
      ] as never),
    ).toBeNull();
  });

  it("detects pickup-ready orders", () => {
    expect(isReadyForPickup({ status_code: "ready_for_pickup" } as never)).toBe(true);
    expect(isReadyForPickup({ status_code: "new_ready_for_pickup" } as never)).toBe(true);
    expect(isReadyForPickup({ status_code: "pending" } as never)).toBe(false);
  });

  it("sums cart total", () => {
    expect(cartTotal([{ price: 100.9, quantity: 2 }, { price: 50, quantity: 1 }])).toBe(250);
  });
});
