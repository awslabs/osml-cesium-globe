// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { formatFeatureProperties, type PropertyGroup } from "@/utils/cesiumFormatters";

describe("formatFeatureProperties", () => {
  it("returns empty array for empty properties", () => {
    const result = formatFeatureProperties({});
    expect(result).toEqual([]);
  });

  it("classifies properties into correct groups", () => {
    const result = formatFeatureProperties({
      class: "building",
      score: 0.95,
      latitude: 38.0,
      longitude: -77.0,
      timestamp: "2025-01-01T00:00:00Z",
      custom_field: "hello"
    });

    const groupNames = result.map((g: PropertyGroup) => g.group);
    expect(groupNames).toContain("CLASSIFICATION");
    expect(groupNames).toContain("LOCATION");
    expect(groupNames).toContain("METADATA");
    expect(groupNames).toContain("OTHER");
  });

  it("formats numeric values correctly", () => {
    const result = formatFeatureProperties({
      score: 0.8542,
      count: 42
    });

    const classGroup = result.find((g) => g.group === "CLASSIFICATION");
    const scoreEntry = classGroup?.entries.find((e) => e.key.toLowerCase().includes("score"));
    // Score < 0.99, so should have 4 decimal places
    expect(scoreEntry?.value).toBe("0.8542");

    const otherGroup = result.find((g) => g.group === "OTHER");
    const countEntry = otherGroup?.entries.find((e) => e.key.toLowerCase().includes("count"));
    expect(countEntry?.value).toBe("42");
  });

  it("skips coordinate-like properties", () => {
    const result = formatFeatureProperties({
      coordinates: [1, 2, 3],
      geometry: { type: "Point" },
      type: "Feature",
      class: "vehicle"
    });

    // Should only have classification group (from class)
    const allEntries = result.flatMap((g) => g.entries);
    expect(allEntries.some((e) => e.key.toLowerCase() === "coordinates")).toBe(false);
    expect(allEntries.some((e) => e.key.toLowerCase() === "geometry")).toBe(false);
    expect(allEntries.some((e) => e.key.toLowerCase() === "type")).toBe(false);
  });

  it("handles nested objects with children", () => {
    const result = formatFeatureProperties({
      metadata: {
        version: "1.0",
        author: "test"
      }
    });

    // Should have an entry with children
    const allEntries = result.flatMap((g) => g.entries);
    const nested = allEntries.find((e) => e.children && e.children.length > 0);
    expect(nested).toBeDefined();
    expect(nested?.children?.length).toBeGreaterThan(0);
  });

  it("truncates long values", () => {
    const longValue = "a".repeat(200);
    const result = formatFeatureProperties({
      long_field: longValue
    });

    const allEntries = result.flatMap((g) => g.entries);
    const entry = allEntries.find((e) => e.key.toLowerCase().includes("long"));
    expect(entry?.value.length).toBeLessThanOrEqual(104); // 100 + "..."
    expect(entry?.value.endsWith("...")).toBe(true);
  });

  it("handles null and undefined values", () => {
    const result = formatFeatureProperties({
      empty_field: null,
      undefined_field: undefined
    });

    const allEntries = result.flatMap((g) => g.entries);
    const nullEntry = allEntries.find((e) => e.key.toLowerCase().includes("empty"));
    expect(nullEntry?.value).toBe("N/A");
  });

  it("handles feature_classes special case with IRI and Score", () => {
    const result = formatFeatureProperties({
      feature_classes: [
        { iri: "http://example.com/building", score: 0.92 }
      ]
    });

    const classGroup = result.find((g) => g.group === "CLASSIFICATION");
    expect(classGroup).toBeDefined();
    const iriEntry = classGroup?.entries.find((e) => e.key === "IRI");
    expect(iriEntry?.value).toBe("http://example.com/building");
    const scoreEntry = classGroup?.entries.find((e) => e.key === "Score");
    expect(scoreEntry?.value).toBe("0.9200");
  });
});
