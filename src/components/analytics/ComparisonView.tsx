// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Side-by-side comparison view for two selected feature collection layers.
 * Shows stats table, classification differences, and spatial overlap summary.
 */

import React from "react";

import type { FeatureCollectionResource } from "@/context/ResourceContext";
import type { ComparisonResult, LayerStats } from "@/types/analytics";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ComparisonViewProps {
  layerA: { resource: FeatureCollectionResource; stats: LayerStats };
  layerB: { resource: FeatureCollectionResource; stats: LayerStats };
  comparisonResult: ComparisonResult | null;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Returns the classification with the highest count, or undefined if empty. */
function getTopClassification(
  counts: Map<string, number>
): { label: string; count: number } | undefined {
  let top: { label: string; count: number } | undefined;
  for (const [label, count] of counts) {
    if (!top || count > top.count) top = { label, count };
  }
  return top;
}

/** Returns the top N classifications by count, descending. */
function getTopNClassifications(
  counts: Map<string, number>,
  n: number
): Array<{ label: string; count: number }> {
  const sorted = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  return sorted.slice(0, n);
}

/* ── Component ─────────────────────────────────────────────────────────── */

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  layerA,
  layerB,
  comparisonResult,
}) => {
  const topA = getTopClassification(layerA.stats.classificationCounts);
  const topB = getTopClassification(layerB.stats.classificationCounts);
  const top3A = getTopNClassifications(layerA.stats.classificationCounts, 3);
  const top3B = getTopNClassifications(layerB.stats.classificationCounts, 3);
  const maxCountA = top3A[0]?.count ?? 1;
  const maxCountB = top3B[0]?.count ?? 1;

  const avgDisplay = (avg: number | undefined) =>
    avg !== undefined ? avg.toFixed(2) : "—";

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 12,
          color: "rgba(255, 255, 255, 0.65)",
          fontWeight: 600,
        }}
      >
        Comparing {layerA.resource.name} & {layerB.resource.name}
      </div>

      {/* Stats comparison table */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "4px 8px",
          }}
        >
          Metric
        </div>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "4px 8px",
            color: layerA.resource.color,
          }}
        >
          {layerA.resource.name}
        </div>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "4px 8px",
            color: layerB.resource.color,
          }}
        >
          {layerB.resource.name}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "4px 8px",
          }}
        >
          Total detections
        </div>
        <div
          style={{
            fontSize: 13,
            color: layerA.resource.color,
            padding: "4px 8px",
          }}
        >
          {layerA.stats.totalFeatures}
        </div>
        <div
          style={{
            fontSize: 13,
            color: layerB.resource.color,
            padding: "4px 8px",
          }}
        >
          {layerB.stats.totalFeatures}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "4px 8px",
          }}
        >
          Avg confidence
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.85)",
            padding: "4px 8px",
          }}
        >
          {avgDisplay(layerA.stats.avgConfidence)}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.85)",
            padding: "4px 8px",
          }}
        >
          {avgDisplay(layerB.stats.avgConfidence)}
        </div>

        <div
          style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "4px 8px",
          }}
        >
          Top classification
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.85)",
            padding: "4px 8px",
          }}
        >
          {topA ? `${topA.label} (${topA.count})` : "—"}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.85)",
            padding: "4px 8px",
          }}
        >
          {topB ? `${topB.label} (${topB.count})` : "—"}
        </div>
      </div>

      {/* Classification breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Classification breakdown
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: layerA.resource.color,
                marginBottom: 4,
              }}
            >
              {layerA.resource.name}
            </div>
            {top3A.length > 0 ? (
              top3A.map(({ label, count }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      flex: "0 0 60px",
                      height: 6,
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(count / maxCountA) * 100}%`,
                        height: "100%",
                        background: layerA.resource.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(255, 255, 255, 0.85)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label} ({count})
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255, 255, 255, 0.5)",
                }}
              >
                No classifications
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: layerB.resource.color,
                marginBottom: 4,
              }}
            >
              {layerB.resource.name}
            </div>
            {top3B.length > 0 ? (
              top3B.map(({ label, count }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      flex: "0 0 60px",
                      height: 6,
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(count / maxCountB) * 100}%`,
                        height: "100%",
                        background: layerB.resource.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(255, 255, 255, 0.85)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label} ({count})
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255, 255, 255, 0.5)",
                }}
              >
                No classifications
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlap section or placeholder */}
      <div
        style={{
          fontSize: 11,
          color: "rgba(255, 255, 255, 0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Spatial overlap
      </div>
      {comparisonResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.85)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: layerA.resource.color,
                flexShrink: 0,
              }}
            />
            Unique to {layerA.resource.name}: {comparisonResult.uniqueToA.size}{" "}
            features
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.85)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: layerB.resource.color,
                flexShrink: 0,
              }}
            />
            Unique to {layerB.resource.name}: {comparisonResult.uniqueToB.size}{" "}
            features
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.85)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "white",
                flexShrink: 0,
              }}
            />
            Overlapping: {comparisonResult.overlapping.length} pairs
          </div>
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          Spatial overlap analysis will be available in a future update
        </div>
      )}
    </div>
  );
};
