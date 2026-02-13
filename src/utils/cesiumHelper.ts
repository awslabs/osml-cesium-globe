// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Barrel re-export for Cesium helper utilities.
 *
 * The implementation is split across three focused modules:
 *  - cesiumFeatures.ts  — GeoJSON loading, feature click handling
 *  - cesiumImagery.ts   — Image/tile loading, Docker-based tile creation
 *  - cesiumFormatters.ts — Property formatting for feature popups
 *
 * All public symbols are re-exported here so existing import paths
 * (`@/utils/cesiumHelper`) continue to work unchanged.
 */

// Feature loading & click handling
export {
  loadGeoJson,
  loadS3GeoJson,
  unloadAllGeoJsonFeatures
} from "@/utils/cesiumFeatures";
export type { FeaturePopupCallback } from "@/utils/cesiumFeatures";

// Imagery / tile loading
export {
  convertImageToCesium,
  loadImageInCesium
} from "@/utils/cesiumImagery";

// Property formatters & types
export {
  formatFeatureProperties
} from "@/utils/cesiumFormatters";
export type { PropertyEntry, PropertyGroup } from "@/utils/cesiumFormatters";
