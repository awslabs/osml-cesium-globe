// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Shared TypeScript types for analytics state, computed stats, and filter models.
 * Used by analytics context, computation utilities, chart components, and globe styling.
 */

/** How features are color-coded on the globe. */
export type ColorMode = "layer" | "confidence" | "classification";

/** An active filter applied from chart interactions. */
export interface AnalyticsFilter {
  id: string;
  type: "classification" | "confidence-range";
  label: string;
  /** For classification filters */
  classificationValue?: string;
  /** For confidence range filters */
  confidenceMin?: number;
  confidenceMax?: number;
}

/** Aggregated statistics for a single feature collection layer. */
export interface LayerStats {
  resourceId: string;
  totalFeatures: number;
  visibleFeatures: number;
  /** Map from classification label to count */
  classificationCounts: Map<string, number>;
  /** Histogram buckets: [0-0.1), [0.1-0.2), ... [0.9-1.0] */
  confidenceHistogram: number[];
  avgConfidence: number | undefined;
  /** Features that have no parseable confidence */
  unknownConfidenceCount: number;
  /** Features that have no classification */
  unclassifiedCount: number;
}

/** Result of comparing two layers spatially. */
export interface ComparisonResult {
  layerAId: string;
  layerBId: string;
  /** Entity IDs unique to layer A */
  uniqueToA: Set<string>;
  /** Entity IDs unique to layer B */
  uniqueToB: Set<string>;
  /** Pairs of entity IDs that overlap spatially */
  overlapping: Array<{ entityA: string; entityB: string }>;
  toleranceMeters: number;
}

/** Color assignment for a classification label. */
export interface ClassificationColor {
  label: string;
  color: string;
}
