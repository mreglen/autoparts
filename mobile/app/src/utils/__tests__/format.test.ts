import { describe, expect, it } from "@jest/globals";

import {
  clientOrderStatusLabel,
  formatMoney,
  formatServerDate,
  formatServerDateTime,
  formatWallClockDateTime,
  normalizeOrderStatus,
  orderStatusLabel,
  toDateInputValue,
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

describe("server dates", () => {
  it("formats date-only values without timezone shift", () => {
    expect(formatServerDate("2026-10-31")).toBe("31.10.2026");
    expect(formatServerDate("2026-10-31T00:00:00")).toBe("31.10.2026");
  });

  it("formats wall-clock datetimes in local time", () => {
    expect(formatWallClockDateTime("2026-10-28T12:35:00")).toContain(
      "28.10.2026",
    );
    expect(formatWallClockDateTime("2026-10-28T12:35:00")).toContain("12:35");
  });

  it("formats server datetimes in local time", () => {
    expect(formatServerDateTime("2026-10-28T09:35:00")).toContain("28.10.2026");
    expect(formatServerDateTime("2026-10-28T09:35:00")).toMatch(/\d{2}:\d{2}/);
    expect(formatServerDateTime(null)).toBe("—");
  });

  it("extracts ISO date for date inputs", () => {
    expect(toDateInputValue("2026-10-28T12:35:00")).toBe("2026-10-28");
    expect(toDateInputValue("2026-10-28")).toBe("2026-10-28");
    expect(toDateInputValue("")).toBe("");
    expect(toDateInputValue(null)).toBe("");
  });
});
