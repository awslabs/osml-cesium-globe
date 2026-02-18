// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Confidence parsing and filtering helpers for loaded GeoJSON detections.
 */

import * as Cesium from "cesium";
import { GeoJsonDataSource } from "cesium";

const CONFIDENCE_KEYS = ["confidence", "conf", "probability", "prob"];
const SCORE_KEYS = ["score"];

/** Clamps a confidence threshold to the supported 0..1 range. */
export function clampConfidenceThreshold(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Normalizes a confidence value to a 0..1 score when possible. */
function normalizeConfidence(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined;
  if (value <= 1) return value;
  if (value <= 100) return value / 100;
  return undefined;
}

/** Returns true when key indicates confidence-like values. */
function isConfidenceKey(key: string): boolean {
  const lower = key.toLowerCase();
  return CONFIDENCE_KEYS.some((candidate) => lower.includes(candidate));
}

/** Returns true when key indicates score-like values. */
function isScoreKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SCORE_KEYS.some((candidate) => lower.includes(candidate));
}

/** Walks nested feature properties and collects confidence candidates. */
function collectConfidenceCandidates(
  value: unknown,
  parentKey: string,
  confidenceCandidates: number[],
  scoreCandidates: number[],
  depth: number = 0
): void {
  if (depth > 4 || value === null || value === undefined) return;

  if (typeof value === "number") {
    const normalized = normalizeConfidence(value);
    if (normalized === undefined) return;
    if (isConfidenceKey(parentKey)) confidenceCandidates.push(normalized);
    if (isScoreKey(parentKey)) scoreCandidates.push(normalized);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectConfidenceCandidates(
        item,
        parentKey,
        confidenceCandidates,
        scoreCandidates,
        depth + 1
      );
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      collectConfidenceCandidates(
        nestedValue,
        key,
        confidenceCandidates,
        scoreCandidates,
        depth + 1
      );
    }
  }
}

/**
 * Extracts a normalized confidence value from GeoJSON feature properties.
 * Prefers explicit confidence keys over generic score keys.
 */
export function extractFeatureConfidence(
  properties: Record<string, unknown>
): number | undefined {
  const confidenceCandidates: number[] = [];
  const scoreCandidates: number[] = [];

  collectConfidenceCandidates(
    properties,
    "",
    confidenceCandidates,
    scoreCandidates
  );

  if (confidenceCandidates.length > 0) return Math.max(...confidenceCandidates);
  if (scoreCandidates.length > 0) return Math.max(...scoreCandidates);
  return undefined;
}

/**
 * Applies a confidence threshold by toggling each feature entity visibility.
 * Returns how many features match the threshold.
 */
export function applyConfidenceFilter(
  dataSource: GeoJsonDataSource,
  threshold: number,
  baseVisible: boolean
): number {
  const clampedThreshold = clampConfidenceThreshold(threshold);
  const now = Cesium.JulianDate.now();
  let matchingCount = 0;

  for (const entity of dataSource.entities.values) {
    const properties = entity.properties?.getValue(now) as
      | Record<string, unknown>
      | undefined;
    const confidence = properties
      ? extractFeatureConfidence(properties)
      : undefined;

    const passes = confidence === undefined || confidence >= clampedThreshold;
    if (passes) matchingCount += 1;
    entity.show = baseVisible && passes;
  }

  return matchingCount;
}
