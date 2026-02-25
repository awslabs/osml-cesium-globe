// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * SVG histogram showing confidence score distribution across 10 bins.
 * Bars are clickable to create confidence-range filters.
 */

import React, { useMemo, useState } from "react";

interface ConfidenceHistogramProps {
  /** 10-element array of counts per bin */
  histogram: number[];
  /** Callback when a bin is clicked — binIndex 0-9 */
  onBinClick?: (binIndex: number) => void;
  /** Set of currently active bin indices (for highlight styling) */
  activeBins?: Set<number>;
}

const BIN_LABELS = [
  "0-10%",
  "10-20%",
  "20-30%",
  "30-40%",
  "40-50%",
  "50-60%",
  "60-70%",
  "70-80%",
  "80-90%",
  "90-100%",
];

/** Color gradient from red (low confidence) to green (high confidence) */
function binColor(index: number): string {
  const colors = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#a3e635",
    "#84cc16",
    "#22c55e",
    "#16a34a",
    "#15803d",
    "#166534",
  ];
  return colors[index];
}

const BAR_GAP = 2;
const BAR_HEIGHT = 50;
const SVG_WIDTH = 260;
const SVG_HEIGHT = 60;

export const ConfidenceHistogram: React.FC<ConfidenceHistogramProps> = ({
  histogram,
  onBinClick,
  activeBins = new Set(),
}) => {
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);

  const { maxCount, barWidth } = useMemo(() => {
    const totalGaps = (histogram.length - 1) * BAR_GAP;
    const availableWidth = SVG_WIDTH - totalGaps;
    const w = availableWidth / histogram.length;
    const max = Math.max(1, ...histogram);
    return { maxCount: max, barWidth: w };
  }, [histogram]);

  const hasData = histogram.some((c) => c > 0);

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
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={baseStyle}
    >
      {histogram.map((count, index) => {
        const x = index * (barWidth + BAR_GAP);
        const height = maxCount > 0 ? (count / maxCount) * BAR_HEIGHT : 0;
        const y = SVG_HEIGHT - 10 - height;
        const isActive = activeBins.has(index);
        const isHovered = hoveredBin === index;

        return (
          <g key={index}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(height, 0)}
              rx={2}
              ry={2}
              fill={binColor(index)}
              stroke={isActive ? "#fff" : "none"}
              strokeWidth={isActive ? 2 : 0}
              opacity={isHovered ? 1 : 0.85}
              style={{
                cursor: onBinClick ? "pointer" : "default",
                transition: "all 0.15s ease",
              }}
              onClick={() => onBinClick?.(index)}
              onMouseEnter={() => setHoveredBin(index)}
              onMouseLeave={() => setHoveredBin(null)}
            >
              <title>{`${BIN_LABELS[index]}: ${count}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
};
