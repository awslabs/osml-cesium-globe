// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Renders active analytics filter chips with individual remove buttons
 * and a bulk "Clear all" action.
 */

import React from "react";

import type { AnalyticsFilter } from "@/types/analytics";

/** Props for the FilterChips component. */
export interface FilterChipsProps {
  filters: AnalyticsFilter[];
  onRemove: (filterId: string) => void;
  onClearAll: () => void;
}

/**
 * Renders active filter chips with remove buttons and optional "Clear all" action.
 * Returns null when there are no filters.
 *
 * @param props.filters - Active filters to display.
 * @param props.onRemove - Called when a single filter chip's close button is clicked.
 * @param props.onClearAll - Called when "Clear all" is clicked.
 */
export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  onRemove,
  onClearAll,
}) => {
  if (filters.length === 0) return null;

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  };

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px 3px 10px",
    borderRadius: 12,
    background: "rgba(0, 115, 187, 0.18)",
    border: "1px solid rgba(0, 115, 187, 0.25)",
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
    fontWeight: 500,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    lineHeight: 1,
    transition: "color 0.15s ease",
  };

  const clearAllStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
    transition: "color 0.15s ease",
  };

  return (
    <div style={containerStyle}>
      {filters.map((filter) => (
        <span key={filter.id} style={chipStyle}>
          {filter.label}
          <button
            type="button"
            aria-label={`Remove filter: ${filter.label}`}
            style={closeButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
            }}
            onClick={() => onRemove(filter.id)}
          >
            ×
          </button>
        </span>
      ))}
      {filters.length >= 2 && (
        <button
          type="button"
          style={clearAllStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
          }}
          onClick={onClearAll}
        >
          Clear all
        </button>
      )}
    </div>
  );
};
