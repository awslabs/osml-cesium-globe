// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Pure computation functions for analytics: stats aggregation and histograms.
 * No React or Cesium dependencies — operates on plain data objects.
 */

import type { ComparisonResult, LayerStats } from "@/types/analytics";

/** Extracted geometry for spatial overlap computation. */
export interface FeatureGeometry {
  entityId: string;
  type: "polygon" | "polyline" | "point";
  /** [lng, lat] coordinate pairs. For polygons the ring is implicitly closed. */
  ring: Array<[number, number]>;
}

/** Parsed feature data used for analytics computation. */
export interface FeatureRecord {
  confidence: number | undefined;
  classification: string | undefined;
  /** Whether the entity is currently shown (not hidden by confidence filter). */
  isVisible: boolean;
}

/** Buckets confidence values into 10 bins: [0-0.1), [0.1-0.2), ... [0.9-1.0]. */
export function computeConfidenceHistogram(values: number[]): number[] {
  const bins = new Array(10).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor(v * 10), 9);
    bins[idx] += 1;
  }
  return bins;
}

/** Computes aggregate statistics for a layer's features. */
export function computeLayerStats(
  resourceId: string,
  features: FeatureRecord[]
): LayerStats {
  const classificationCounts = new Map<string, number>();
  const confidenceValues: number[] = [];
  let unknownConfidenceCount = 0;
  let unclassifiedCount = 0;
  let visibleCount = 0;

  for (const f of features) {
    if (f.isVisible) visibleCount += 1;

    if (f.confidence !== undefined) {
      confidenceValues.push(f.confidence);
    } else {
      unknownConfidenceCount += 1;
    }

    if (f.classification) {
      classificationCounts.set(
        f.classification,
        (classificationCounts.get(f.classification) ?? 0) + 1
      );
    } else {
      unclassifiedCount += 1;
    }
  }

  const avgConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
      : undefined;

  return {
    resourceId,
    totalFeatures: features.length,
    visibleFeatures: visibleCount,
    classificationCounts,
    confidenceHistogram: computeConfidenceHistogram(confidenceValues),
    avgConfidence,
    unknownConfidenceCount,
    unclassifiedCount,
  };
}

/* ── Geometry intersection primitives ─────────────────────────────────── */

/** Cross product of vectors (ox,oy)→(ax,ay) and (ox,oy)→(bx,by). */
function cross(
  ox: number, oy: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}

/** True when point (rx,ry) lies on the axis-aligned bounding box of segment (px,py)→(qx,qy). */
function onSegment(
  px: number, py: number,
  qx: number, qy: number,
  rx: number, ry: number
): boolean {
  return (
    Math.min(px, qx) <= rx && rx <= Math.max(px, qx) &&
    Math.min(py, qy) <= ry && ry <= Math.max(py, qy)
  );
}

/** True when segment (a1→a2) crosses segment (b1→b2). */
function segmentsIntersect(
  a1x: number, a1y: number, a2x: number, a2y: number,
  b1x: number, b1y: number, b2x: number, b2y: number
): boolean {
  const d1 = cross(b1x, b1y, b2x, b2y, a1x, a1y);
  const d2 = cross(b1x, b1y, b2x, b2y, a2x, a2y);
  const d3 = cross(a1x, a1y, a2x, a2y, b1x, b1y);
  const d4 = cross(a1x, a1y, a2x, a2y, b2x, b2y);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  if (d1 === 0 && onSegment(b1x, b1y, b2x, b2y, a1x, a1y)) return true;
  if (d2 === 0 && onSegment(b1x, b1y, b2x, b2y, a2x, a2y)) return true;
  if (d3 === 0 && onSegment(a1x, a1y, a2x, a2y, b1x, b1y)) return true;
  if (d4 === 0 && onSegment(a1x, a1y, a2x, a2y, b2x, b2y)) return true;
  return false;
}

/** Ray-casting point-in-polygon test. */
function pointInPolygon(
  px: number,
  py: number,
  ring: Array<[number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Fast AABB pre-check to skip obviously non-overlapping pairs. */
function bboxOverlap(
  a: Array<[number, number]>,
  b: Array<[number, number]>
): boolean {
  let aMinX = Infinity, aMaxX = -Infinity, aMinY = Infinity, aMaxY = -Infinity;
  for (const [x, y] of a) {
    if (x < aMinX) aMinX = x;
    if (x > aMaxX) aMaxX = x;
    if (y < aMinY) aMinY = y;
    if (y > aMaxY) aMaxY = y;
  }
  let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
  for (const [x, y] of b) {
    if (x < bMinX) bMinX = x;
    if (x > bMaxX) bMaxX = x;
    if (y < bMinY) bMinY = y;
    if (y > bMaxY) bMaxY = y;
  }
  return aMinX <= bMaxX && aMaxX >= bMinX && aMinY <= bMaxY && aMaxY >= bMinY;
}

/**
 * True when two polygon rings share any interior area.
 * Checks vertex containment in both directions, then edge crossing.
 */
function polygonsIntersect(
  a: Array<[number, number]>,
  b: Array<[number, number]>
): boolean {
  if (!bboxOverlap(a, b)) return false;

  for (const [x, y] of a) {
    if (pointInPolygon(x, y, b)) return true;
  }
  for (const [x, y] of b) {
    if (pointInPolygon(x, y, a)) return true;
  }
  for (let i = 0; i < a.length; i++) {
    const ni = (i + 1) % a.length;
    for (let j = 0; j < b.length; j++) {
      const nj = (j + 1) % b.length;
      if (segmentsIntersect(
        a[i][0], a[i][1], a[ni][0], a[ni][1],
        b[j][0], b[j][1], b[nj][0], b[nj][1]
      )) {
        return true;
      }
    }
  }
  return false;
}

/** True when any segment of the polyline enters the polygon interior. */
function polylineIntersectsPolygon(
  line: Array<[number, number]>,
  poly: Array<[number, number]>
): boolean {
  for (const [x, y] of line) {
    if (pointInPolygon(x, y, poly)) return true;
  }
  for (let i = 0; i < line.length - 1; i++) {
    for (let j = 0; j < poly.length; j++) {
      const nj = (j + 1) % poly.length;
      if (segmentsIntersect(
        line[i][0], line[i][1], line[i + 1][0], line[i + 1][1],
        poly[j][0], poly[j][1], poly[nj][0], poly[nj][1]
      )) {
        return true;
      }
    }
  }
  return false;
}

/** Dispatches the correct intersection test based on geometry types. */
function geometriesIntersect(a: FeatureGeometry, b: FeatureGeometry): boolean {
  if (a.type === "polygon" && b.type === "polygon") {
    return polygonsIntersect(a.ring, b.ring);
  }
  if (a.type === "point" && b.type === "polygon") {
    return pointInPolygon(a.ring[0][0], a.ring[0][1], b.ring);
  }
  if (a.type === "polygon" && b.type === "point") {
    return pointInPolygon(b.ring[0][0], b.ring[0][1], a.ring);
  }
  if (a.type === "polyline" && b.type === "polygon") {
    return polylineIntersectsPolygon(a.ring, b.ring);
  }
  if (a.type === "polygon" && b.type === "polyline") {
    return polylineIntersectsPolygon(b.ring, a.ring);
  }
  return false;
}

/* ── Spatial overlap (geometry intersection) ─────────────────────────── */

/**
 * Finds spatially overlapping features between two layers using actual
 * geometry intersection (polygon masks, point-in-polygon, edge crossing)
 * instead of centroid distance.
 *
 * @param layerAId - Identifier for layer A.
 * @param layerBId - Identifier for layer B.
 * @param layerA - Geometries of features in layer A.
 * @param layerB - Geometries of features in layer B.
 * @returns Comparison result with overlapping pairs and unique entity IDs.
 */
export function computeSpatialOverlap(
  layerAId: string,
  layerBId: string,
  layerA: FeatureGeometry[],
  layerB: FeatureGeometry[]
): ComparisonResult {
  const overlapping: Array<{ entityA: string; entityB: string }> = [];
  const matchedB = new Set<string>();
  const matchedA = new Set<string>();

  for (const a of layerA) {
    for (const b of layerB) {
      if (matchedB.has(b.entityId)) continue;
      if (geometriesIntersect(a, b)) {
        overlapping.push({ entityA: a.entityId, entityB: b.entityId });
        matchedA.add(a.entityId);
        matchedB.add(b.entityId);
        break;
      }
    }
  }

  const uniqueToA = new Set(
    layerA.filter((a) => !matchedA.has(a.entityId)).map((a) => a.entityId)
  );
  const uniqueToB = new Set(
    layerB.filter((b) => !matchedB.has(b.entityId)).map((b) => b.entityId)
  );

  return {
    layerAId,
    layerBId,
    uniqueToA,
    uniqueToB,
    overlapping,
    toleranceMeters: 0,
  };
}
