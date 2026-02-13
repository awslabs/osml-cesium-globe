// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React, { useContext, useEffect, useRef, useState } from "react";
import { CesiumContext } from "resium";
import * as Cesium from "cesium";

import { POPUP_MARGIN, POPUP_MAX_HEIGHT, POPUP_VERTICAL_OFFSET, POPUP_WIDTH } from "@/config";

import "./FeaturePopup.css";

/** A single key-value entry in a property group */
export interface PropertyEntry {
  key: string;
  value: string;
  children?: PropertyEntry[];
}

/** A group of property entries (e.g., CLASSIFICATION, LOCATION, etc.) */
export interface PropertyGroup {
  group: string;
  entries: PropertyEntry[];
}

/** Data describing the feature popup to display */
export interface FeaturePopupData {
  position: Cesium.Cartesian3;
  properties: PropertyGroup[];
  color: string;
  featureType?: string;
}

interface FeaturePopupProps {
  data: FeaturePopupData;
  onClose: () => void;
}

/** Group label display names */
const GROUP_LABELS: Record<string, string> = {
  CLASSIFICATION: "Classification",
  LOCATION: "Location",
  METADATA: "Metadata",
  OTHER: "Details"
};

/** Group icons */
const GROUP_ICONS: Record<string, React.ReactNode> = {
  CLASSIFICATION: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 1l7 4v6l-7 4-7-4V5l7-4z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2" fill="currentColor" fillOpacity="0.5" />
    </svg>
  ),
  LOCATION: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 1C5.24 1 3 3.24 3 6c0 4.5 5 9 5 9s5-4.5 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" fillOpacity="0.5" />
    </svg>
  ),
  METADATA: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  OTHER: (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 8v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
};

/** Recursive entry renderer that handles nested children */
const EntryRow: React.FC<{ entry: PropertyEntry; depth: number }> = ({ entry, depth }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = entry.children && entry.children.length > 0;

  return (
    <div className="fp-entry-wrapper">
      <div
        className={`fp-entry ${hasChildren ? "fp-entry--parent" : ""}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            className="fp-entry-toggle"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              className={`fp-entry-chevron ${expanded ? "fp-entry-chevron--open" : ""}`}
            >
              <path d="M2 1l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <span className="fp-entry-spacer" />
        )}
        <span className="fp-key">{entry.key}</span>
        {entry.value && (
          <span className="fp-value" title={entry.value}>
            {entry.value}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="fp-entry-children">
          {entry.children!.map((child, i) => (
            <EntryRow key={`${child.key}-${i}`} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const FeaturePopup: React.FC<FeaturePopupProps> = ({ data, onClose }) => {
  const cesium = useContext(CesiumContext);
  const popupRef = useRef<HTMLDivElement>(null);
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);

  // Convert world position to screen coordinates on each frame
  useEffect(() => {
    const viewer = cesium.viewer;
    if (!viewer) return;

    const updatePosition = () => {
      const pos = Cesium.SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        data.position
      );
      if (pos) {
        setScreenPos({ x: pos.x, y: pos.y });
      }
    };

    // Initial position
    updatePosition();

    // Animate in after first position
    requestAnimationFrame(() => setVisible(true));

    // Update on camera change
    viewer.scene.preRender.addEventListener(updatePosition);
    return () => {
      viewer.scene.preRender.removeEventListener(updatePosition);
    };
  }, [cesium.viewer, data.position]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!screenPos) return null;

  // Determine the header title from the first classification entry or feature type
  const classGroup = data.properties.find((g) => g.group === "CLASSIFICATION");
  const featureType =
    data.featureType ||
    classGroup?.entries.find(
      (e) => e.key.toLowerCase().includes("class") || e.key === "IRI"
    )?.value ||
    "Feature";

  // Clamp popup to viewport bounds
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = screenPos.x - POPUP_WIDTH / 2;
  let top = screenPos.y - POPUP_MAX_HEIGHT - POPUP_VERTICAL_OFFSET; // above the point

  // If not enough room above, show below
  if (top < POPUP_MARGIN) {
    top = screenPos.y + POPUP_VERTICAL_OFFSET;
  }
  // Clamp horizontal
  if (left < POPUP_MARGIN) left = POPUP_MARGIN;
  if (left + POPUP_WIDTH > vw - POPUP_MARGIN) left = vw - POPUP_MARGIN - POPUP_WIDTH;
  // Clamp vertical
  if (top + POPUP_MAX_HEIGHT > vh - POPUP_MARGIN) {
    top = vh - POPUP_MARGIN - POPUP_MAX_HEIGHT;
  }

  return (
    <div
      ref={popupRef}
      className={`fp-popup ${visible ? "fp-popup--visible" : ""}`}
      style={{ left, top }}
    >
      {/* Connector line to the point */}
      <div
        className="fp-connector"
        style={{
          left: screenPos.x - left,
          borderColor: data.color
        }}
      />

      {/* Header */}
      <div className="fp-header">
        <div className="fp-header-left">
          <span className="fp-dot" style={{ background: data.color }} />
          <span className="fp-title" title={featureType}>{featureType}</span>
        </div>
        <button className="fp-close" onClick={onClose} title="Close">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3L3 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="fp-body">
        {data.properties.length === 0 ? (
          <div className="fp-empty">No metadata available</div>
        ) : (
          data.properties.map((group) => (
            <div key={group.group} className="fp-group">
              <div className="fp-group-header">
                <span className="fp-group-icon">
                  {GROUP_ICONS[group.group] || GROUP_ICONS.OTHER}
                </span>
                <span className="fp-group-label">
                  {GROUP_LABELS[group.group] || group.group}
                </span>
              </div>
              <div className="fp-group-entries">
                {group.entries.map((entry, i) => (
                  <EntryRow key={`${entry.key}-${i}`} entry={entry} depth={0} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FeaturePopup;
