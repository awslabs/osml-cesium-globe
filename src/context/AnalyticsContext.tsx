// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * React context for analytics-specific derived state and UI controls.
 * Reads from ResourceContext and provides computed stats, filters, and comparison data.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useResources, type FeatureCollectionResource } from "@/context/ResourceContext";
import type {
  AnalyticsFilter,
  ColorMode,
  ComparisonResult,
  LayerStats,
} from "@/types/analytics";
import { computeLayerStats, computeSpatialOverlap } from "@/utils/analyticsCompute";
import {
  extractFeaturesFromDataSource,
  extractEntityGeometries,
} from "@/utils/analyticsExtract";

/** Value provided by AnalyticsContext: derived stats, filters, and comparison state. */
interface AnalyticsContextValue {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  activeFilters: AnalyticsFilter[];
  addFilter: (filter: AnalyticsFilter) => void;
  removeFilter: (filterId: string) => void;
  clearFilters: () => void;
  selectedLayerIds: string[];
  toggleLayerSelection: (layerId: string) => void;
  layerStats: Map<string, LayerStats>;
  comparisonResult: ComparisonResult | null;
  featureCollections: FeatureCollectionResource[];
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resources } = useResources();
  const [colorMode, setColorMode] = useState<ColorMode>("layer");
  const [activeFilters, setActiveFilters] = useState<AnalyticsFilter[]>([]);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);

  const featureCollections = useMemo(
    () => resources.filter((r): r is FeatureCollectionResource => r.type === "feature-collection"),
    [resources]
  );

  const layerStats = useMemo(() => {
    const stats = new Map<string, LayerStats>();
    for (const fc of featureCollections) {
      const features = extractFeaturesFromDataSource(fc.dataSource);
      stats.set(fc.id, computeLayerStats(fc.id, features));
    }
    return stats;
  }, [featureCollections]);

  const addFilter = useCallback((filter: AnalyticsFilter) => {
    setActiveFilters((prev) => {
      if (prev.some((f) => f.id === filter.id)) return prev;
      return [...prev, filter];
    });
  }, []);

  const removeFilter = useCallback((filterId: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  const clearFilters = useCallback(() => setActiveFilters([]), []);

  const toggleLayerSelection = useCallback((layerId: string) => {
    setSelectedLayerIds((prev) => {
      if (prev.includes(layerId)) return prev.filter((id) => id !== layerId);
      if (prev.length >= 2) return [prev[1], layerId];
      return [...prev, layerId];
    });
  }, []);

  const comparisonResult: ComparisonResult | null = useMemo(() => {
    if (selectedLayerIds.length !== 2) return null;
    const fcA = featureCollections.find((fc) => fc.id === selectedLayerIds[0]);
    const fcB = featureCollections.find((fc) => fc.id === selectedLayerIds[1]);
    if (!fcA || !fcB) return null;

    const geomsA = extractEntityGeometries(fcA.dataSource);
    const geomsB = extractEntityGeometries(fcB.dataSource);
    return computeSpatialOverlap(fcA.id, fcB.id, geomsA, geomsB);
  }, [selectedLayerIds, featureCollections]);

  return (
    <AnalyticsContext.Provider
      value={{
        colorMode,
        setColorMode,
        activeFilters,
        addFilter,
        removeFilter,
        clearFilters,
        selectedLayerIds,
        toggleLayerSelection,
        layerStats,
        comparisonResult,
        featureCollections,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};

/** Hook to access analytics context. Must be used within AnalyticsProvider. */
export const useAnalytics = (): AnalyticsContextValue => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
};
