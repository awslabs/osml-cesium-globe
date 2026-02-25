// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Extracts feature records from Cesium GeoJsonDataSource entities
 * for use with analytics computation functions.
 */

import * as Cesium from "cesium";
import { GeoJsonDataSource } from "cesium";

import { extractFeatureConfidence } from "@/utils/featureConfidence";
import type { FeatureGeometry, FeatureRecord } from "@/utils/analyticsCompute";

const CLASSIFICATION_KEYS = [
  "classification",
  "class",
  "category",
  "label",
  "featureclassiri",
  "feature_class_iri",
];

/**
 * Extracts a classification label from feature properties.
 * Handles both flat string properties (e.g. `classification: "Vehicle"`) and
 * OSML Model Runner's nested format (e.g. `feature_classes: [{ iri: "Vehicle", score: 0.9 }]`).
 */
export function extractClassification(
  properties: Record<string, unknown>
): string | undefined {
  // First: check for OSML Model Runner's feature_classes format
  const featureClasses = properties["feature_classes"] ?? properties["featureClasses"];
  if (featureClasses != null) {
    const items = Array.isArray(featureClasses) ? featureClasses : [featureClasses];
    for (const item of items) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const iri = obj["iri"] ?? obj["Iri"] ?? obj["IRI"];
        if (typeof iri === "string" && iri.length > 0) return iri;
      }
    }
  }

  // Second: check flat top-level string properties
  for (const [propKey, propValue] of Object.entries(properties)) {
    if (typeof propValue !== "string") continue;
    const lower = propKey.toLowerCase();
    if (CLASSIFICATION_KEYS.some((k) => lower.includes(k))) {
      return propValue;
    }
  }

  // Third: walk one level into nested objects looking for classification-like strings
  for (const [, propValue] of Object.entries(properties)) {
    if (propValue && typeof propValue === "object" && !Array.isArray(propValue)) {
      const nested = propValue as Record<string, unknown>;
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        if (typeof nestedValue !== "string") continue;
        const lower = nestedKey.toLowerCase();
        if (CLASSIFICATION_KEYS.some((k) => lower.includes(k))) {
          return nestedValue;
        }
      }
    }
  }

  return undefined;
}

/** Converts all entities in a GeoJsonDataSource to FeatureRecords. */
export function extractFeaturesFromDataSource(
  dataSource: GeoJsonDataSource
): FeatureRecord[] {
  const now = Cesium.JulianDate.now();
  const records: FeatureRecord[] = [];

  for (const entity of dataSource.entities.values) {
    const props = entity.properties?.getValue(now) as
      | Record<string, unknown>
      | undefined;

    records.push({
      confidence: props ? extractFeatureConfidence(props) : undefined,
      classification: props ? extractClassification(props) : undefined,
      isVisible: entity.show !== false,
    });
  }

  return records;
}

/** Converts a Cartesian3 to a [lng, lat] pair. */
function cartesianToLngLat(cartesian: Cesium.Cartesian3): [number, number] {
  const carto = Cesium.Cartographic.fromCartesian(cartesian);
  return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)];
}

/**
 * Extracts full geometries (polygon rings, polyline paths, point positions)
 * from all entities in a GeoJsonDataSource. Polygons are prioritized over
 * point positions so the full mask is captured.
 */
export function extractEntityGeometries(
  dataSource: GeoJsonDataSource
): FeatureGeometry[] {
  const now = Cesium.JulianDate.now();
  const geometries: FeatureGeometry[] = [];

  for (const entity of dataSource.entities.values) {
    if (entity.polygon) {
      const hierarchy = entity.polygon.hierarchy?.getValue(now);
      if (hierarchy?.positions?.length) {
        const ring: Array<[number, number]> = hierarchy.positions.map(
          (pos: Cesium.Cartesian3) => cartesianToLngLat(pos)
        );
        geometries.push({ entityId: entity.id, type: "polygon", ring });
      }
    } else if (entity.polyline) {
      const pts = entity.polyline.positions?.getValue(now);
      if (pts?.length) {
        const ring: Array<[number, number]> = pts.map(
          (pos: Cesium.Cartesian3) => cartesianToLngLat(pos)
        );
        geometries.push({ entityId: entity.id, type: "polyline", ring });
      }
    } else if (entity.position) {
      const cartesian = entity.position.getValue(now);
      if (cartesian) {
        geometries.push({
          entityId: entity.id,
          type: "point",
          ring: [cartesianToLngLat(cartesian)],
        });
      }
    }
  }

  return geometries;
}
