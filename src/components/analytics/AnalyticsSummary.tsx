// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Per-layer analytics summary card displaying feature count, confidence
 * distribution, and classification breakdown with interactive charts.
 */

import React from "react";

import type { FeatureCollectionResource } from "@/context/ResourceContext";
import type { LayerStats } from "@/types/analytics";
import "@/components/ui/FormControls.css";

import { ClassificationChart } from "./ClassificationChart";
import { ConfidenceHistogram } from "./ConfidenceHistogram";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface AnalyticsSummaryProps {
  resource: FeatureCollectionResource;
  stats: LayerStats;
  isSelected: boolean;
  onToggleSelection: () => void;
  onClassificationClick: (label: string) => void;
  onConfidenceBinClick: (binIndex: number) => void;
  activeBins?: Set<number>;
  activeClassifications?: Set<string>;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Formats a Date as relative time (e.g. "2m ago", "just now"). */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const ms = now - date.getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (s < 60) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export const AnalyticsSummary: React.FC<AnalyticsSummaryProps> = ({
  resource,
  stats,
  isSelected,
  onToggleSelection,
  onClassificationClick,
  onConfidenceBinClick,
  activeBins = new Set(),
  activeClassifications = new Set(),
}) => {
  const avgDisplay =
    stats.avgConfidence !== undefined
      ? `Avg: ${stats.avgConfidence.toFixed(2)}`
      : "Avg: —";

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${isSelected ? "rgba(0, 115, 187, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
        borderRadius: 12,
        padding: 12,
        transition: "all 0.15s ease",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          className={`df-checkbox ${isSelected ? "df-checkbox--checked" : ""}`}
          onClick={onToggleSelection}
          style={{ cursor: "pointer" }}
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 5l2.5 2.5L8 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.9)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 200,
          }}
          title={resource.name}
        >
          {resource.name}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.6)",
            background: "rgba(255, 255, 255, 0.08)",
            padding: "2px 8px",
            borderRadius: 999,
            flexShrink: 0,
          }}
        >
          {stats.totalFeatures}
        </span>
      </div>

      {/* Confidence histogram */}
      <ConfidenceHistogram
        histogram={stats.confidenceHistogram}
        onBinClick={onConfidenceBinClick}
        activeBins={activeBins}
      />

      {/* Classification chart */}
      <ClassificationChart
        classificationCounts={stats.classificationCounts}
        onClassClick={onClassificationClick}
        activeLabels={activeClassifications}
      />

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "rgba(255, 255, 255, 0.4)",
        }}
      >
        <span>{avgDisplay}</span>
        <span style={{ color: "rgba(255, 255, 255, 0.3)" }}>
          {formatRelativeTime(resource.loadedAt)}
        </span>
      </div>
    </div>
  );
};
