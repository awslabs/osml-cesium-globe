// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Feature styling functions for analytics-driven globe visualization.
 * Applies color-coding by confidence, classification, or layer,
 * and filter-based dimming for non-matching features.
 */

import * as Cesium from "cesium";
import { Color, GeoJsonDataSource } from "cesium";

import type {
  AnalyticsFilter,
  ColorMode,
  ComparisonResult,
} from "@/types/analytics";
import { extractClassification } from "@/utils/analyticsExtract";
import { extractFeatureConfidence } from "@/utils/featureConfidence";

const CLASSIFICATION_PALETTE = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#ef4444",
  "#6366f1",
  "#84cc16",
];

/** Returns true when entity properties match all active filters. */
function matchesAllFilters(
  properties: Record<string, unknown>,
  filters: AnalyticsFilter[]
): boolean {
  return filters.every((filter) => {
    if (filter.type === "classification") {
      const classification = extractClassification(properties);
      return classification === filter.classificationValue;
    }
    if (filter.type === "confidence-range") {
      const confidence = extractFeatureConfidence(properties);
      if (confidence === undefined) return false;
      return (
        confidence >= (filter.confidenceMin ?? 0) &&
        confidence <= (filter.confidenceMax ?? 1)
      );
    }
    return true;
  });
}

/**
 * Maps a 0..1 confidence value to a red-yellow-green gradient.
 * 0.0 = red, 0.5 = yellow, 1.0 = green.
 */
export function confidenceToColor(value: number): Cesium.Color {
  const clamped = Math.max(0, Math.min(1, value));
  const r = clamped < 0.5 ? 1.0 : 1.0 - (clamped - 0.5) * 2;
  const g = clamped < 0.5 ? clamped * 2 : 1.0;
  return new Cesium.Color(r, g, 0.2, 1.0);
}

/**
 * Returns a consistent color for a classification label from the palette.
 */
export function classificationToColor(
  label: string,
  knownLabels: string[]
): Cesium.Color {
  const idx = knownLabels.indexOf(label);
  const paletteIdx = idx >= 0 ? idx % CLASSIFICATION_PALETTE.length : 0;
  return Cesium.Color.fromCssColorString(CLASSIFICATION_PALETTE[paletteIdx]);
}

/**
 * Re-styles all entities in a data source based on the current color mode.
 */
export function applyColorMode(
  dataSource: GeoJsonDataSource,
  colorMode: ColorMode,
  layerColor: string,
  knownClassifications: string[],
  fillAlpha: number,
  strokeAlpha: number
): void {
  const now = Cesium.JulianDate.now();
  const entities = dataSource.entities.values;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    let color: Cesium.Color;

    if (colorMode === "layer") {
      color = Color.fromCssColorString(layerColor);
    } else if (colorMode === "confidence") {
      const props = entity.properties?.getValue(now) as
        | Record<string, unknown>
        | undefined;
      const confidence = props ? extractFeatureConfidence(props) : undefined;
      color =
        confidence !== undefined ? confidenceToColor(confidence) : Color.GRAY;
    } else {
      const props = entity.properties?.getValue(now) as
        | Record<string, unknown>
        | undefined;
      const classification = props
        ? extractClassification(props)
        : undefined;
      color = classification
        ? classificationToColor(classification, knownClassifications)
        : Color.GRAY;
    }

    if (entity.polygon) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(fillAlpha)
      );
      if (entity.polygon.outlineColor) {
        entity.polygon.outlineColor = new Cesium.ConstantProperty(
          color.withAlpha(strokeAlpha)
        );
      }
    }
    if (entity.polyline) {
      entity.polyline.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(strokeAlpha)
      );
    }
  }
}

/**
 * Applies filter-based dimming: matching features at full opacity,
 * non-matching at ~8% opacity.
 */
export function applyFilterHighlighting(
  dataSource: GeoJsonDataSource,
  filters: AnalyticsFilter[],
  baseVisible: boolean
): void {
  if (filters.length === 0) return;

  const now = Cesium.JulianDate.now();
  const entities = dataSource.entities.values;
  const dimAlpha = 0.08;

  for (const entity of entities) {
    if (!baseVisible) {
      entity.show = false;
      continue;
    }

    const props = entity.properties?.getValue(now) as
      | Record<string, unknown>
      | undefined;
    const matches = props ? matchesAllFilters(props, filters) : false;

    if (entity.polygon) {
      const currentMaterial = entity.polygon.material;
      if (currentMaterial instanceof Cesium.ColorMaterialProperty) {
        const currentColor = currentMaterial.color?.getValue(now);
        if (currentColor) {
          const alpha = matches ? 0.3 : dimAlpha;
          entity.polygon.material = new Cesium.ColorMaterialProperty(
            currentColor.withAlpha(alpha)
          );
        }
      }
    }
    if (entity.polyline) {
      const currentMaterial = entity.polyline.material;
      if (currentMaterial instanceof Cesium.ColorMaterialProperty) {
        const currentColor = currentMaterial.color?.getValue(now);
        if (currentColor) {
          const alpha = matches ? 0.9 : dimAlpha;
          entity.polyline.material = new Cesium.ColorMaterialProperty(
            currentColor.withAlpha(alpha)
          );
        }
      }
    }
  }
}

/**
 * Applies comparison overlay styling to two data sources.
 * Features unique to each layer get their layer color with enhanced outline.
 * Overlapping features get a white outline. Entities that weren't part of the
 * spatial analysis (no extractable position) are left unchanged.
 */
export function applyComparisonOverlay(
  dataSourceA: GeoJsonDataSource,
  dataSourceB: GeoJsonDataSource,
  comparisonResult: ComparisonResult,
  colorA: string,
  colorB: string,
  fillAlpha: number,
  strokeAlpha: number
): void {
  const cesiumColorA = Color.fromCssColorString(colorA);
  const cesiumColorB = Color.fromCssColorString(colorB);
  const overlapColor = Color.WHITE;

  const overlappingAIds = new Set(comparisonResult.overlapping.map((p) => p.entityA));
  const overlappingBIds = new Set(comparisonResult.overlapping.map((p) => p.entityB));

  // Style layer A entities
  for (const entity of dataSourceA.entities.values) {
    const isOverlapping = overlappingAIds.has(entity.id);
    const isUnique = comparisonResult.uniqueToA.has(entity.id);
    if (!isOverlapping && !isUnique) continue;

    const color = isOverlapping ? overlapColor : cesiumColorA;
    const outlineWidth = isOverlapping ? 3 : 2;

    if (entity.polygon) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(fillAlpha)
      );
      entity.polygon.outlineColor = new Cesium.ConstantProperty(
        color.withAlpha(strokeAlpha)
      );
      entity.polygon.outlineWidth = new Cesium.ConstantProperty(outlineWidth);
    }
    if (entity.polyline) {
      entity.polyline.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(strokeAlpha)
      );
      entity.polyline.width = new Cesium.ConstantProperty(outlineWidth);
    }
  }

  // Style layer B entities
  for (const entity of dataSourceB.entities.values) {
    const isOverlapping = overlappingBIds.has(entity.id);
    const isUnique = comparisonResult.uniqueToB.has(entity.id);
    if (!isOverlapping && !isUnique) continue;

    const color = isOverlapping ? overlapColor : cesiumColorB;
    const outlineWidth = isOverlapping ? 3 : 2;

    if (entity.polygon) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(fillAlpha)
      );
      entity.polygon.outlineColor = new Cesium.ConstantProperty(
        color.withAlpha(strokeAlpha)
      );
      entity.polygon.outlineWidth = new Cesium.ConstantProperty(outlineWidth);
    }
    if (entity.polyline) {
      entity.polyline.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(strokeAlpha)
      );
      entity.polyline.width = new Cesium.ConstantProperty(outlineWidth);
    }
  }
}
