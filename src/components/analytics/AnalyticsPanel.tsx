// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Collapsible right-side analytics panel that displays per-layer stats,
 * interactive charts, comparison views, and filter controls.
 */

import React, { useMemo } from "react";

import { useAnalytics } from "@/context/AnalyticsContext";
import { useAnalyticsGlobeStyling } from "@/hooks/useAnalyticsGlobeStyling";
import type { AnalyticsFilter, ColorMode } from "@/types/analytics";

import { AnalyticsSummary } from "./AnalyticsSummary";
import { ComparisonView } from "./ComparisonView";
import { FilterChips } from "./FilterChips";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface AnalyticsPanelProps {
  onClose: () => void;
}

/* ── Filter helpers ─────────────────────────────────────────────────────── */

/** Builds a classification filter from a clicked label. */
function buildClassificationFilter(label: string): AnalyticsFilter {
  return {
    id: `class-${label}`,
    type: "classification",
    label: `Classification: ${label}`,
    classificationValue: label,
  };
}

/** Builds a confidence-range filter from a clicked bin index (0–9). */
function buildConfidenceFilter(binIndex: number): AnalyticsFilter {
  const min = binIndex * 0.1;
  const max = binIndex === 9 ? 1.0 : (binIndex + 1) * 0.1;
  return {
    id: `conf-${binIndex}`,
    type: "confidence-range",
    label: `Confidence: ${Math.round(min * 100)}-${Math.round(max * 100)}%`,
    confidenceMin: min,
    confidenceMax: max,
  };
}

/* ── Component ─────────────────────────────────────────────────────────── */

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "layer", label: "By Layer" },
  { value: "confidence", label: "By Confidence" },
  { value: "classification", label: "By Classification" },
];

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ onClose }) => {
  useAnalyticsGlobeStyling();

  const {
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
  } = useAnalytics();

  const activeBins = useMemo(() => {
    const bins = new Set<number>();
    for (const f of activeFilters) {
      if (f.type === "confidence-range" && f.confidenceMin !== undefined) {
        const idx = Math.min(9, Math.floor(f.confidenceMin * 10));
        bins.add(idx);
      }
    }
    return bins;
  }, [activeFilters]);

  const activeClassifications = useMemo(() => {
    const labels = new Set<string>();
    for (const f of activeFilters) {
      if (f.type === "classification" && f.classificationValue) {
        labels.add(f.classificationValue);
      }
    }
    return labels;
  }, [activeFilters]);

  const comparisonLayers = useMemo(() => {
    if (selectedLayerIds.length !== 2) return null;
    const [idA, idB] = selectedLayerIds;
    const resA = featureCollections.find((r) => r.id === idA);
    const resB = featureCollections.find((r) => r.id === idB);
    const statsA = resA ? layerStats.get(idA) : undefined;
    const statsB = resB ? layerStats.get(idB) : undefined;
    if (!resA || !resB || !statsA || !statsB) return null;
    return {
      layerA: { resource: resA, stats: statsA },
      layerB: { resource: resB, stats: statsB },
    };
  }, [selectedLayerIds, featureCollections, layerStats]);

  const isEmpty = featureCollections.length === 0;

  return (
    <>
      <style>{`
        @keyframes analytics-slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        className="analytics-panel"
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          bottom: 20,
          width: 340,
          maxWidth: "calc(100vw - 80px)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "rgba(12, 15, 22, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16,
          padding: 16,
          zIndex: 1000,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          animation: "analytics-slide-in 0.2s ease",
        }}
      >
        {/* Panel header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            Analytics
          </span>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value as ColorMode)}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              color: "rgba(255, 255, 255, 0.9)",
              cursor: "pointer",
            }}
          >
            {COLOR_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close analytics panel"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: "pointer",
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.4)",
              lineHeight: 1,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
            }}
          >
            ×
          </button>
        </div>

        {/* FilterChips */}
        <FilterChips
          filters={activeFilters}
          onRemove={removeFilter}
          onClearAll={clearFilters}
        />

        {/* Scrollable card list or empty state */}
        {isEmpty ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.35)",
            }}
          >
            Load feature data to see analytics
          </div>
        ) : (
          <div
            className="dark-scroll"
            style={{
              flexGrow: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {featureCollections.map((resource) => {
              const stats = layerStats.get(resource.id);
              if (!stats) return null;
              return (
                <AnalyticsSummary
                  key={resource.id}
                  resource={resource}
                  stats={stats}
                  isSelected={selectedLayerIds.includes(resource.id)}
                  onToggleSelection={() => toggleLayerSelection(resource.id)}
                  onClassificationClick={(label) =>
                    addFilter(buildClassificationFilter(label))
                  }
                  onConfidenceBinClick={(binIndex) =>
                    addFilter(buildConfidenceFilter(binIndex))
                  }
                  activeBins={activeBins}
                  activeClassifications={activeClassifications}
                />
              );
            })}

            {/* ComparisonView — shown only when exactly 2 layers selected */}
            {selectedLayerIds.length === 2 && comparisonLayers && (
              <ComparisonView
                layerA={comparisonLayers.layerA}
                layerB={comparisonLayers.layerB}
                comparisonResult={comparisonResult}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AnalyticsPanel;
