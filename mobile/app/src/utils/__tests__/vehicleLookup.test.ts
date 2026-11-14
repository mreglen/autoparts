import { describe, expect, it } from "@jest/globals";

import {
  candidateLabel,
  detectVehicleLookupKind,
  formatVehicleLookupInput,
  looksLikeRuPlate,
  looksLikeVin,
  mapCandidateToCreatePayload,
  mapCandidateToGarageForm,
  normalizeGarageVinOrNull,
  normalizePlate,
  normalizeVinForLookupOrNull,
  normalizeVinOrNull,
  sanitizeVinInput,
} from "../vehicleLookup";

describe("VIN", () => {
  it("detects and sanitizes a valid VIN", () => {
    expect(looksLikeVin("WBA3A5C50CF256789")).toBe(true);
    expect(normalizeVinOrNull("wba3a5c50cf256789")).toBe("WBA3A5C50CF256789");
  });

  it("maps cyrillic lookalikes and strips separators", () => {
    expect(sanitizeVinInput("аве-мнортух")).toBe("ABEMHOPTYX");
    expect(sanitizeVinInput("WBA-3A5 C50")).toBe("WBA3A5C50");
  });

  it("rejects part numbers and forbidden letters", () => {
    expect(looksLikeVin("VAG059198405")).toBe(false);
    expect(looksLikeVin("IOQ12345678901")).toBe(false);
  });

  it("fixes common OCR confusions for lookup", () => {
    expect(normalizeVinForLookupOrNull("WBA3A5C5OCF256789")).toBe(
      "WBA3A5C50CF256789",
    );
  });

  it("accepts relaxed chassis numbers for garage storage", () => {
    expect(normalizeGarageVinOrNull("KGC100075792")).toBe("KGC100075792");
    expect(normalizeGarageVinOrNull("12345")).toBeNull();
  });
});

describe("plate", () => {
  it("normalizes latin lookalikes to cyrillic", () => {
    expect(normalizePlate("a123bc77")).toBe("А123ВС77");
    expect(looksLikeRuPlate("А 123 ВС 77")).toBe(true);
    expect(looksLikeRuPlate("А123БВ77")).toBe(false);
    expect(looksLikeRuPlate("hello")).toBe(false);
  });
});

describe("detectVehicleLookupKind", () => {
  it("detects vin / plate / frame", () => {
    expect(detectVehicleLookupKind("WBA3A5C50CF256789")).toBe("vin");
    expect(detectVehicleLookupKind("А123ВС77")).toBe("plate");
    expect(detectVehicleLookupKind("GHI-123456")).toBe("frame");
    expect(detectVehicleLookupKind("123")).toBeNull();
    expect(detectVehicleLookupKind("")).toBeNull();
  });

  it("formats input per detected kind", () => {
    expect(formatVehicleLookupInput("wba-3a5c50cf256789")).toBe(
      "WBA3A5C50CF256789",
    );
    expect(formatVehicleLookupInput("a123bc 77")).toBe("A123BC 77");
  });
});

describe("candidate mapping", () => {
  const candidate = {
    make: "BMW",
    model: "Unknown",
    display_name: "BMW 3 Series",
    year: 2019,
    color: "Black",
    engine: "2.0",
    catalog: "bmw",
    vehicle_id: "v1",
    attributes_raw: [{ key: "a", value: "b" }],
  };

  it("maps candidate into form fields", () => {
    const form = mapCandidateToGarageForm(
      candidate,
      "WBA3A5C50CF256789",
      "А123БВ77",
    );
    expect(form.make).toBe("BMW");
    expect(form.model).toBe("3 Series");
    expect(form.year).toBe("2019");
    expect(form.color).toBe("Black");
    expect(form.plate).toBe("А123БВ77");
    expect(form.vin).toBe("WBA3A5C50CF256789");
  });

  it("falls back to display_name for model", () => {
    const form = mapCandidateToGarageForm(
      { make: "Kia", display_name: "Kia Rio", year: null },
      "",
    );
    expect(form.model).toBe("Rio");
  });

  it("builds manual payload without candidate", () => {
    const payload = mapCandidateToCreatePayload(null, {
      vin: "WBA3A5C50CF256789",
      make: "BMW",
      model: "3",
      year: "2019",
      color: "",
      plate: "",
      notes: "",
    });
    expect(payload.source).toBe("manual");
    expect(payload.laximo_catalog).toBeUndefined();
    expect(payload.year).toBe(2019);
  });

  it("builds laximo payload with catalog fields", () => {
    const payload = mapCandidateToCreatePayload(
      candidate,
      {
        vin: "WBA3A5C50CF256789",
        make: "BMW",
        model: "3 Series",
        year: "2019",
        color: "Black",
        plate: "",
        notes: "",
      },
      { fromFrame: true, frameQuery: "ABC-123" },
    );
    expect(payload.source).toBe("laximo");
    expect(payload.laximo_catalog).toBe("bmw");
    expect(payload.laximo_vehicle_id).toBe("v1");
    expect(payload.laximo_attributes).toEqual([
      { key: "a", value: "b" },
      { key: "frame_query", value: "ABC-123" },
    ]);
  });

  it("uses plate/frame source when no catalog", () => {
    const payload = mapCandidateToCreatePayload(
      { make: "Kia" },
      {
        vin: "",
        make: "Kia",
        model: "",
        year: "",
        color: "",
        plate: "А123БВ77",
        notes: "",
      },
      { fromPlate: true },
    );
    expect(payload.source).toBe("plate");
  });

  it("formats candidate label", () => {
    expect(candidateLabel(candidate)).toContain("BMW 3 Series");
    expect(candidateLabel(candidate)).toContain("2019");
  });
});
