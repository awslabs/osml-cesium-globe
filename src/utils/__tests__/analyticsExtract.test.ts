// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { extractFeaturesFromDataSource } from "../analyticsExtract";

// Mock Cesium
jest.mock("cesium", () => ({
  JulianDate: {
    now: jest.fn(() => ({})),
  },
  GeoJsonDataSource: jest.fn(),
}));

// Mock featureConfidence
jest.mock("../featureConfidence", () => ({
  extractFeatureConfidence: jest.fn((props: Record<string, unknown>) => {
    return typeof props.confidence === "number" ? props.confidence : undefined;
  }),
}));

function makeMockDataSource(entities: Array<Record<string, unknown>>) {
  return {
    entities: {
      values: entities.map((props) => ({
        properties: {
          getValue: () => props,
        },
      })),
    },
  } as any;
}

describe("extractFeaturesFromDataSource", () => {
  it("extracts confidence and classification from entities", () => {
    const ds = makeMockDataSource([
      { confidence: 0.9, classification: "Vehicle" },
      { confidence: 0.5, category: "Building" },
    ]);
    const records = extractFeaturesFromDataSource(ds);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ confidence: 0.9, classification: "Vehicle", isVisible: true });
    expect(records[1]).toEqual({ confidence: 0.5, classification: "Building", isVisible: true });
  });

  it("handles entities with no properties", () => {
    const ds = {
      entities: {
        values: [{ properties: undefined }],
      },
    } as any;
    const records = extractFeaturesFromDataSource(ds);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      confidence: undefined,
      classification: undefined,
      isVisible: true,
    });
  });

  it("returns empty array for empty data source", () => {
    const ds = makeMockDataSource([]);
    const records = extractFeaturesFromDataSource(ds);
    expect(records).toHaveLength(0);
  });

  it("extracts classification from OSML feature_classes nested format", () => {
    const ds = makeMockDataSource([
      {
        confidence: 0.9,
        feature_classes: [{ iri: "Aircraft", score: 0.9 }],
      },
    ]);
    const records = extractFeaturesFromDataSource(ds);
    expect(records).toHaveLength(1);
    expect(records[0].classification).toBe("Aircraft");
  });

  it("extracts classification from feature_classes with multiple items", () => {
    const ds = makeMockDataSource([
      {
        confidence: 0.85,
        feature_classes: [
          { iri: "Vehicle", score: 0.85 },
          { iri: "Car", score: 0.6 },
        ],
      },
    ]);
    const records = extractFeaturesFromDataSource(ds);
    expect(records[0].classification).toBe("Vehicle");
  });

  it("extracts classification from nested object properties", () => {
    const ds = makeMockDataSource([
      {
        confidence: 0.7,
        metadata: { classification: "Building" },
      },
    ]);
    const records = extractFeaturesFromDataSource(ds);
    expect(records[0].classification).toBe("Building");
  });

  it("reports hidden entities as not visible", () => {
    const ds = {
      entities: {
        values: [
          {
            show: false,
            properties: { getValue: () => ({ confidence: 0.2, classification: "Vehicle" }) },
          },
          {
            show: true,
            properties: { getValue: () => ({ confidence: 0.9, classification: "Vehicle" }) },
          },
        ],
      },
    } as any;
    const records = extractFeaturesFromDataSource(ds);
    expect(records).toHaveLength(2);
    expect(records[0].isVisible).toBe(false);
    expect(records[1].isVisible).toBe(true);
  });
});
