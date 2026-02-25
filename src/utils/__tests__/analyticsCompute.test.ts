// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import {
  computeLayerStats,
  computeConfidenceHistogram,
  computeSpatialOverlap,
  type FeatureGeometry,
} from "../analyticsCompute";

/** Builds a square polygon geometry centered on (lng, lat) with the given half-size in degrees. */
function makeBox(entityId: string, lng: number, lat: number, halfSize: number): FeatureGeometry {
  return {
    entityId,
    type: "polygon",
    ring: [
      [lng - halfSize, lat - halfSize],
      [lng + halfSize, lat - halfSize],
      [lng + halfSize, lat + halfSize],
      [lng - halfSize, lat + halfSize],
    ],
  };
}

describe("computeConfidenceHistogram", () => {
  it("buckets confidence values into 10 bins", () => {
    const values = [0.0, 0.15, 0.55, 0.99, 1.0];
    const histogram = computeConfidenceHistogram(values);
    expect(histogram).toHaveLength(10);
    expect(histogram[0]).toBe(1);  // 0.0
    expect(histogram[1]).toBe(1);  // 0.15
    expect(histogram[5]).toBe(1);  // 0.55
    expect(histogram[9]).toBe(2);  // 0.99, 1.0
  });

  it("returns all zeros for empty input", () => {
    const histogram = computeConfidenceHistogram([]);
    expect(histogram).toEqual(new Array(10).fill(0));
  });
});

describe("computeLayerStats", () => {
  it("aggregates classification counts from feature properties", () => {
    const features = [
      { confidence: 0.9, classification: "Vehicle", isVisible: true },
      { confidence: 0.8, classification: "Vehicle", isVisible: true },
      { confidence: 0.5, classification: "Building", isVisible: true },
    ];
    const stats = computeLayerStats("layer-1", features);
    expect(stats.totalFeatures).toBe(3);
    expect(stats.visibleFeatures).toBe(3);
    expect(stats.classificationCounts.get("Vehicle")).toBe(2);
    expect(stats.classificationCounts.get("Building")).toBe(1);
    expect(stats.avgConfidence).toBeCloseTo(0.733, 2);
  });

  it("handles features with missing confidence", () => {
    const features = [
      { confidence: undefined, classification: "Vehicle", isVisible: true },
    ];
    const stats = computeLayerStats("layer-1", features);
    expect(stats.unknownConfidenceCount).toBe(1);
    expect(stats.avgConfidence).toBeUndefined();
  });

  it("handles features with missing classification", () => {
    const features = [
      { confidence: 0.9, classification: undefined, isVisible: true },
    ];
    const stats = computeLayerStats("layer-1", features);
    expect(stats.unclassifiedCount).toBe(1);
  });

  it("counts only visible features in visibleFeatures", () => {
    const features = [
      { confidence: 0.9, classification: "Vehicle", isVisible: true },
      { confidence: 0.3, classification: "Vehicle", isVisible: false },
      { confidence: 0.5, classification: "Building", isVisible: true },
    ];
    const stats = computeLayerStats("layer-1", features);
    expect(stats.totalFeatures).toBe(3);
    expect(stats.visibleFeatures).toBe(2);
  });
});

describe("computeSpatialOverlap", () => {
  it("detects overlapping polygons", () => {
    const layerA = [
      makeBox("a1", -77.0, 38.0, 0.001),
      makeBox("a2", -78.0, 39.0, 0.001),
    ];
    const layerB = [
      makeBox("b1", -77.0005, 38.0005, 0.001),
      makeBox("b2", -80.0, 40.0, 0.001),
    ];
    const result = computeSpatialOverlap("layerA", "layerB", layerA, layerB);
    expect(result.overlapping).toHaveLength(1);
    expect(result.overlapping[0]).toEqual({ entityA: "a1", entityB: "b1" });
    expect(result.uniqueToA.has("a2")).toBe(true);
    expect(result.uniqueToB.has("b2")).toBe(true);
  });

  it("returns all unique when polygons do not overlap", () => {
    const layerA = [makeBox("a1", 0, 0, 0.001)];
    const layerB = [makeBox("b1", 50, 50, 0.001)];
    const result = computeSpatialOverlap("layerA", "layerB", layerA, layerB);
    expect(result.overlapping).toHaveLength(0);
    expect(result.uniqueToA.size).toBe(1);
    expect(result.uniqueToB.size).toBe(1);
  });

  it("handles empty layers", () => {
    const result = computeSpatialOverlap("a", "b", [], []);
    expect(result.overlapping).toHaveLength(0);
    expect(result.uniqueToA.size).toBe(0);
    expect(result.uniqueToB.size).toBe(0);
  });

  it("detects when one polygon fully contains another", () => {
    const outer = makeBox("a1", 0, 0, 0.01);
    const inner = makeBox("b1", 0, 0, 0.001);
    const result = computeSpatialOverlap("A", "B", [outer], [inner]);
    expect(result.overlapping).toHaveLength(1);
  });

  it("does not match nearby polygons that do not intersect", () => {
    const left: FeatureGeometry = {
      entityId: "a1",
      type: "polygon",
      ring: [[0, 0], [1, 0], [1, 1], [0, 1]],
    };
    const right: FeatureGeometry = {
      entityId: "b1",
      type: "polygon",
      ring: [[1.01, 0], [2, 0], [2, 1], [1.01, 1]],
    };
    const result = computeSpatialOverlap("A", "B", [left], [right]);
    expect(result.overlapping).toHaveLength(0);
  });

  it("detects point inside polygon", () => {
    const poly = makeBox("a1", 0, 0, 1);
    const point: FeatureGeometry = { entityId: "b1", type: "point", ring: [[0, 0]] };
    const result = computeSpatialOverlap("A", "B", [poly], [point]);
    expect(result.overlapping).toHaveLength(1);
  });
});
