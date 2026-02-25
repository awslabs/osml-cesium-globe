// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * SVG horizontal stacked bar showing classification type proportions.
 * Segments are clickable to create classification filters.
 */

import React, { useMemo, useState } from "react";

interface ClassificationChartProps {
  /** Map from classification label to count */
  classificationCounts: Map<string, number>;
  /** Callback when a classification segment is clicked */
  onClassClick?: (label: string) => void;
  /** Set of currently active classification labels (for highlight styling) */
  activeLabels?: Set<string>;
}

const PALETTE = [
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

const BAR_HEIGHT = 16;
const SVG_WIDTH = 260;
const SVG_HEIGHT = 24;
const LEGEND_ITEM_HEIGHT = 14;
const LEGEND_DOT_SIZE = 6;

export const ClassificationChart: React.FC<ClassificationChartProps> = ({
  classificationCounts,
  onClassClick,
  activeLabels = new Set(),
}) => {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const { entries, total } = useMemo(() => {
    const entries = Array.from(classificationCounts.entries())
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, c]) => sum + c, 0);
    return { entries, total };
  }, [classificationCounts]);

  const hasData = entries.length > 0;

  const baseStyle: React.CSSProperties = {
    transition: "all 0.15s ease",
  };

  const labelStyle: React.CSSProperties = {
    fill: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    fontFamily: "system-ui, sans-serif",
  };

  if (!hasData) {
    return (
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={baseStyle}
      >
        <text
          x={SVG_WIDTH / 2}
          y={SVG_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ ...labelStyle, fill: "rgba(255, 255, 255, 0.4)" }}
        >
          No classifications
        </text>
      </svg>
    );
  }

  let offsetX = 0;

  const segments = entries.map(([label, count], index) => {
    const width = total > 0 ? (count / total) * SVG_WIDTH : 0;
    const isLeftmost = index === 0;
    const isRightmost = index === entries.length - 1;
    const rx = isLeftmost || isRightmost ? 4 : 0;
    const isActive = activeLabels.has(label);
    const isHovered = hoveredLabel === label;
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";

    const segment = (
      <rect
        key={label}
        x={offsetX}
        y={0}
        width={Math.max(width, 0)}
        height={BAR_HEIGHT}
        rx={rx}
        ry={rx}
        fill={PALETTE[index % PALETTE.length]}
        stroke={isActive ? "#fff" : "none"}
        strokeWidth={isActive ? 2 : 0}
        opacity={isHovered ? 1 : 0.9}
        style={{
          cursor: onClassClick ? "pointer" : "default",
          transition: "all 0.15s ease",
        }}
        onClick={() => onClassClick?.(label)}
        onMouseEnter={() => setHoveredLabel(label)}
        onMouseLeave={() => setHoveredLabel(null)}
      >
        <title>{`${label}: ${count} (${pct}%)`}</title>
      </rect>
    );

    offsetX += width;
    return segment;
  });

  const legendEntries = entries.slice(0, 5);
  const moreCount = entries.length - 5;
  const legendHeight = legendEntries.length * LEGEND_ITEM_HEIGHT + (moreCount > 0 ? LEGEND_ITEM_HEIGHT : 0);
  const totalSvgHeight = SVG_HEIGHT + 4 + legendHeight;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${totalSvgHeight}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={baseStyle}
    >
      <g transform={`translate(0, 0)`}>{segments}</g>

      <g transform={`translate(0, ${SVG_HEIGHT + 4})`}>
        {legendEntries.map(([label], index) => (
          <g key={label} transform={`translate(0, ${index * LEGEND_ITEM_HEIGHT})`}>
            <rect
              x={0}
              y={LEGEND_ITEM_HEIGHT / 2 - LEGEND_DOT_SIZE / 2}
              width={LEGEND_DOT_SIZE}
              height={LEGEND_DOT_SIZE}
              rx={LEGEND_DOT_SIZE / 2}
              fill={PALETTE[index % PALETTE.length]}
            />
            <text
              x={LEGEND_DOT_SIZE + 6}
              y={LEGEND_ITEM_HEIGHT / 2}
              dominantBaseline="middle"
              style={labelStyle}
            >
              {label}
            </text>
          </g>
        ))}
        {moreCount > 0 && (
          <g transform={`translate(0, ${5 * LEGEND_ITEM_HEIGHT})`}>
            <text
              x={LEGEND_DOT_SIZE + 6}
              y={LEGEND_ITEM_HEIGHT / 2}
              dominantBaseline="middle"
              style={{ ...labelStyle, fill: "rgba(255, 255, 255, 0.5)" }}
            >
              {moreCount} more
            </text>
          </g>
        )}
      </g>
    </svg>
  );
};
