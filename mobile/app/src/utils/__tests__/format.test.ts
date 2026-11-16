import { describe, expect, it } from "@jest/globals";

import {
  clientOrderStatusLabel,
  formatMoney,
  normalizeOrderStatus,
  orderStatusLabel,
} from "../format";

describe("order statuses", () => {
  it("maps legacy statuses", () => {
    expect(normalizeOrderStatus("ready")).toBe("completed");
    expect(normalizeOrderStatus("issued")).toBe("completed");
    expect(normalizeOrderStatus("accepted")).toBe("pending");
  });

  it("staff labels stay staff terms", () => {
    expect(orderStatusLabel("in_progress")).toBe("В работе");
    expect(orderStatusLabel("completed")).toBe("Закрыт");
  });

  it("client labels use client terms", () => {
    expect(clientOrderStatusLabel("pending")).toBe("Запланирован");
    expect(clientOrderStatusLabel("in_progress")).toBe("Авто у мастера");
    expect(clientOrderStatusLabel("completed")).toBe("Завершён");
    expect(clientOrderStatusLabel("cancelled")).toBe("Отменён");
    expect(clientOrderStatusLabel("ready")).toBe("Завершён");
  });
});

describe("formatMoney", () => {
  it("formats numbers and numeric strings", () => {
    expect(formatMoney(1500)).toContain("1");
    expect(formatMoney("2500.50")).toContain("2");
    expect(formatMoney(null)).toContain("0");
  });
});
