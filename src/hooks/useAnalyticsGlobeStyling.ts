// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Watches AnalyticsContext state and applies color-coding and
 * filter highlighting to Cesium data sources on change.
 */

import { useEffect, useMemo } from "react";

import { useAnalytics } from "@/context/AnalyticsContext";
import { DEFAULT_RESULTS_FILL_ALPHA, DEFAULT_RESULTS_LINE_ALPHA } from "@/config";
import {
  applyColorMode,
  applyFilterHighlighting,
  applyComparisonOverlay,
} from "@/utils/cesiumStyling";

/** Applies analytics-driven styling to the globe when color mode or filters change. */
export function useAnalyticsGlobeStyling(): void {
  const {
    colorMode,
    activeFilters,
    featureCollections,
    layerStats,
    comparisonResult,
    selectedLayerIds,
  } = useAnalytics();

  // Collect all known classification labels across all layers
  // (needed for consistent color assignment in classification mode)
  const knownClassifications = useMemo(
    () =>
      Array.from(
        new Set(
          Array.from(layerStats.values()).flatMap((stats) =>
            Array.from(stats.classificationCounts.keys())
          )
        )
      ),
    [layerStats]
  );

  // Single unified effect: base color → comparison overlay → filter highlighting.
  // Merging all three avoids desync between independent effects (e.g. clearing
  // filters not restoring opacity, or deselecting comparison layers not resetting
  // entity colors).
  useEffect(() => {
    // 1. Always re-apply base color mode (restores proper alphas)
    for (const fc of featureCollections) {
      applyColorMode(
        fc.dataSource,
        colorMode,
        fc.color,
        knownClassifications,
        DEFAULT_RESULTS_FILL_ALPHA,
        DEFAULT_RESULTS_LINE_ALPHA
      );
    }

    // 2. Layer comparison overlay on top when two layers are selected
    if (comparisonResult && selectedLayerIds.length === 2) {
      const fcA = featureCollections.find((fc) => fc.id === selectedLayerIds[0]);
      const fcB = featureCollections.find((fc) => fc.id === selectedLayerIds[1]);
      if (fcA && fcB) {
        applyComparisonOverlay(
          fcA.dataSource,
          fcB.dataSource,
          comparisonResult,
          fcA.color,
          fcB.color,
          DEFAULT_RESULTS_FILL_ALPHA,
          DEFAULT_RESULTS_LINE_ALPHA
        );
      }
    }

    // 3. Layer filter highlighting on top of everything
    if (activeFilters.length > 0) {
      for (const fc of featureCollections) {
        applyFilterHighlighting(fc.dataSource, activeFilters, fc.visible);
      }
    }
  }, [colorMode, featureCollections, knownClassifications, activeFilters, comparisonResult, selectedLayerIds]);
}
