// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Main slide-out panel with action buttons, layer management, and modal triggers.
 */

import React, { useContext, useState } from "react";
import { CesiumContext } from "resium";

import {
  FeatureCollectionResource,
  ImageryResource,
  LoadedResource,
  useResources
} from "@/context/ResourceContext";
import type { ImageRequestState } from "@/types";

import CredsExpiredAlert from "./alert/CredsExpiredAlert";
import LoadDataModal from "./modal/LoadDataModal";
import LoadImageModal from "./modal/LoadImageModal";
import ImageRequestModal from "./modal/ImageRequestModal";

import "./OsmlMenu.css";

interface OsmlMenuProps {
  imageRequestStatus: ImageRequestState;
  setImageRequestStatus: React.Dispatch<React.SetStateAction<ImageRequestState>>;
  onFeatureClick?: (data: import("@/components/FeaturePopup").FeaturePopupData | null) => void;
}

const OsmlMenu: React.FC<OsmlMenuProps> = ({
  imageRequestStatus,
  setImageRequestStatus,
  onFeatureClick
}) => {
  const cesium = useContext(CesiumContext);
  const { resources, removeResource, toggleVisibility, zoomTo, clearAll } = useResources();

  const [isOpen, setIsOpen] = useState(false);
  const [showImageRequestModal, setShowImageRequestModal] = useState(false);
  const [showLoadDataModal, setShowLoadDataModal] = useState(false);
  const [showLoadImageModal, setShowLoadImageModal] = useState(false);
  const [showCredsExpiredAlert, setShowCredsExpiredAlert] = useState(false);

  const featureCollections = resources.filter(
    (r): r is FeatureCollectionResource => r.type === "feature-collection"
  );
  const imageryLayers = resources.filter(
    (r): r is ImageryResource => r.type === "imagery"
  );

  const totalCount = resources.length;

  const isRequestProcessing =
    imageRequestStatus.state === "loading" ||
    imageRequestStatus.state === "pending" ||
    imageRequestStatus.state === "in-progress";

  const handleAction = (action: string) => {
    if (action === "request") setShowImageRequestModal(true);
    else if (action === "geojson") setShowLoadDataModal(true);
    else if (action === "image") setShowLoadImageModal(true);
  };

  const handleRemove = (id: string) => {
    if (cesium.viewer) removeResource(id, cesium.viewer);
  };

  const handleToggleVisibility = (id: string) => {
    if (cesium.viewer) toggleVisibility(id, cesium.viewer);
  };

  const handleZoomTo = (id: string) => {
    if (cesium.viewer) zoomTo(id, cesium.viewer);
  };

  const handleClearAll = () => {
    if (cesium.viewer) clearAll(cesium.viewer);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const renderResourceItem = (resource: LoadedResource) => {
    const isFC = resource.type === "feature-collection";
    const fc = isFC ? (resource as FeatureCollectionResource) : null;

    return (
      <div
        key={resource.id}
        className={`op-layer ${!resource.visible ? "op-layer--hidden" : ""}`}
      >
        <div className="op-layer-main">
          <div className="op-layer-icon">
            {isFC ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L2 6v4l6 5 6-5V6L8 1z" stroke="currentColor" strokeWidth="1.5" fill={fc?.color || "currentColor"} fillOpacity="0.3" />
                <circle cx="8" cy="6" r="2" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M1 11l4-4 2 2 3-4 5 6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <circle cx="11" cy="5.5" r="1.5" fill="currentColor" fillOpacity="0.6" />
              </svg>
            )}
          </div>
          <div className="op-layer-info">
            <div className="op-layer-name" title={resource.name}>{resource.name}</div>
            <div className="op-layer-meta">
              <span className={`op-badge op-badge--${resource.source}`}>
                {resource.source === "s3" ? "S3" : "Local"}
              </span>
              {fc && fc.color && (
                <span
                  className="op-color-dot"
                  style={{ background: fc.color }}
                  title={`Color: ${fc.color}`}
                />
              )}
              {fc && (
                <span className="op-layer-count">
                  {fc.featureCount.toLocaleString()} feature{fc.featureCount !== 1 ? "s" : ""}
                </span>
              )}
              <span className="op-layer-time">{formatTime(resource.loadedAt)}</span>
            </div>
          </div>
          <div className="op-layer-actions">
            <button
              className={`op-act-btn ${!resource.visible ? "op-act-btn--dim" : ""}`}
              onClick={() => handleToggleVisibility(resource.id)}
              title={resource.visible ? "Hide" : "Show"}
            >
              {resource.visible ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
                  <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </button>
            <button className="op-act-btn" onClick={() => handleZoomTo(resource.id)} title="Zoom to">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <line x1="11" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <button className="op-act-btn op-act-btn--danger" onClick={() => handleRemove(resource.id)} title="Remove">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4M6.5 7v5M9.5 7v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M3.5 4l.5 9a1.5 1.5 0 001.5 1.5h5A1.5 1.5 0 0012 13l.5-9" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyLayers = () => (
    <div className="op-layers-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7l9 5 9-5-9-5z" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.25" />
        <path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.18" />
        <path d="M3 17l9 5 9-5" stroke="currentColor" strokeWidth="1.3" strokeOpacity="0.12" />
      </svg>
      <span>No layers loaded yet</span>
      <span className="op-layers-empty-sub">Use the actions above to get started</span>
    </div>
  );

  return (
    <>
      {/* Toggle button */}
      <button
        className={`op-toggle ${isOpen ? "op-toggle--open" : ""} ${isRequestProcessing ? "op-toggle--processing" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Close panel" : "Open panel"}
        aria-label={isOpen ? "Close panel" : "Open panel"}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="op-toggle-icon">
          <line x1="2" y1="4.5" x2="16" y2="4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="2" y1="13.5" x2="16" y2="13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {totalCount > 0 && <span className="op-toggle-badge">{totalCount}</span>}
        {isRequestProcessing && <span className="op-toggle-pulse" />}
      </button>

      {/* Unified panel */}
      <div className={`op-panel ${isOpen ? "op-panel--open" : ""}`}>
        {/* Header */}
        <div className="op-header">
          <div className="op-header-title">
            <img src="/logo.png" alt="OSML" className="op-header-logo" />
            <span>OSML</span>
          </div>
          <button
            className="op-close-btn"
            onClick={() => setIsOpen(false)}
            title="Close"
            aria-label="Close panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Actions section */}
        <div className="op-actions">
          <div className="op-actions-label">Actions</div>
          <div className="op-actions-grid">
            <button className="op-action-card" onClick={() => handleAction("request")}>
              <div className="op-action-icon op-action-icon--request">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2v6l4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span className="op-action-label">Submit Request</span>
            </button>

            <button className="op-action-card" onClick={() => handleAction("geojson")}>
              <div className="op-action-icon op-action-icon--geojson">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M4 3h8l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M7 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="op-action-label">Load GeoJSON</span>
            </button>

            <button className="op-action-card" onClick={() => handleAction("image")}>
              <div className="op-action-icon op-action-icon--image">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2 14l5-5 3 3 3-4 5 6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="13" cy="7.5" r="1.5" fill="currentColor" fillOpacity="0.5" />
                </svg>
              </div>
              <span className="op-action-label">Load Image</span>
            </button>
          </div>
        </div>

        {/* Layers section */}
        <div className="op-layers">
          <div className="op-layers-header">
            <span className="op-layers-title">Layers</span>
            {totalCount > 0 && (
              <button className="op-clear-all" onClick={handleClearAll} title="Clear all layers">
                Clear All
              </button>
            )}
          </div>

          <div className="op-layers-content">
            {totalCount === 0 ? (
              renderEmptyLayers()
            ) : (
              <>
                {/* Feature Collections */}
                {featureCollections.length > 0 && (
                  <div className="op-layer-group">
                    <div className="op-layer-group-header">
                      <span>Feature Collections</span>
                      <span className="op-layer-group-count">{featureCollections.length}</span>
                    </div>
                    {featureCollections.map(renderResourceItem)}
                  </div>
                )}

                {/* Imagery */}
                {imageryLayers.length > 0 && (
                  <div className="op-layer-group">
                    <div className="op-layer-group-header">
                      <span>Imagery</span>
                      <span className="op-layer-group-count">{imageryLayers.length}</span>
                    </div>
                    {imageryLayers.map(renderResourceItem)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Click-away overlay */}
      {isOpen && <div className="op-overlay" onClick={() => setIsOpen(false)} />}

      {/* Modals */}
      {showCredsExpiredAlert && (
        <CredsExpiredAlert setShowCredsExpiredAlert={setShowCredsExpiredAlert} />
      )}
      <LoadDataModal
        showLoadDataModal={showLoadDataModal}
        setShowLoadDataModal={setShowLoadDataModal}
        showCredsExpiredAlert={showCredsExpiredAlert}
        setShowCredsExpiredAlert={setShowCredsExpiredAlert}
        onFeatureClick={onFeatureClick}
      />
      <LoadImageModal
        showLoadImageModal={showLoadImageModal}
        setShowLoadImageModal={setShowLoadImageModal}
        showCredsExpiredAlert={showCredsExpiredAlert}
        setShowCredsExpiredAlert={setShowCredsExpiredAlert}
      />
      <ImageRequestModal
        showImageRequestModal={showImageRequestModal}
        setShowImageRequestModal={setShowImageRequestModal}
        imageRequestStatus={imageRequestStatus}
        setImageRequestStatus={setImageRequestStatus}
        showCredsExpiredAlert={showCredsExpiredAlert}
        setShowCredsExpiredAlert={setShowCredsExpiredAlert}
        onFeatureClick={onFeatureClick}
      />
    </>
  );
};

export default OsmlMenu;
