// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Root React component that initializes the Cesium viewer and composes the application layout. */

import "./styles.css";

import React, { useState, useEffect, useCallback } from "react";
import { Viewer as ResiumViewer, CesiumComponentRef } from "resium";
import * as Cesium from "cesium";

import OsmlTray from "@/components/OsmlTray";
import StatusDisplay from "@/components/StatusDisplay";
import Logo from "@/components/Logo";
import FeaturePopup, { type FeaturePopupData } from "@/components/FeaturePopup";
import ConfigWarnings from "@/components/alert/ConfigWarnings";
import { ResourceProvider } from "@/context/ResourceContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";
import { AnalyticsPanel } from "@/components/analytics";
import type { ImageRequestState } from "@/types";

/** Natural Earth II fallback (offline, bundled with Cesium) */
function naturalEarthLayer(): Cesium.ImageryLayer {
  return Cesium.ImageryLayer.fromProviderAsync(
    Cesium.TileMapServiceImageryProvider.fromUrl(
      Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
    )
  );
}

/** Try ArcGIS World Imagery; fall back to Natural Earth II on failure */
async function resolveBaseLayer(): Promise<Cesium.ImageryLayer> {
  try {
    const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
    );
    return new Cesium.ImageryLayer(provider);
  } catch {
    return naturalEarthLayer();
  }
}

const App = () => {
  const [imageRequestStatus, setImageRequestStatus] = useState<ImageRequestState>({
    state: "idle",
    data: {}
  });

  const [baseLayer, setBaseLayer] = useState<Cesium.ImageryLayer | null>(null);
  const [featurePopupData, setFeaturePopupData] = useState<FeaturePopupData | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Callback for feature clicks -- called from cesiumHelper
  const handleFeaturePopup = useCallback((data: FeaturePopupData | null) => {
    setFeaturePopupData(data);
  }, []);

  // Resolve the base layer once before rendering the Viewer
  useEffect(() => {
    resolveBaseLayer().then(setBaseLayer);
  }, []);

  // Configure atmosphere & lighting once the Viewer is ready
  const viewerRef = useCallback((ref: CesiumComponentRef<Cesium.Viewer> | null) => {
    const viewer = ref?.cesiumElement;
    if (!viewer) return;

    // Globe atmosphere & lighting
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.enableLighting = true;

    // Sky atmosphere (already exists on the scene by default)
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
    }

    // Sun
    if (viewer.scene.sun) {
      viewer.scene.sun.show = true;
    }

    // Subtle distance fog
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0003;
    viewer.scene.fog.minimumBrightness = 0.02;
  }, []);

  // Wait until we know which layer to use so Viewer is only created once
  if (!baseLayer) return null;

  return (
    <>
    <ConfigWarnings />
    <ResiumViewer
      ref={viewerRef}
      full
      baseLayer={baseLayer}
      timeline={false}
      animation={false}
      geocoder={false}
      homeButton={false}
      sceneModePicker={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      fullscreenButton={false}
    >
      <ResourceProvider>
        <AnalyticsProvider>
          <Logo />
          <OsmlTray
            imageRequestStatus={imageRequestStatus}
            setImageRequestStatus={setImageRequestStatus}
            onFeatureClick={handleFeaturePopup}
          />
          <div className="analytics-toggle">
            <button
              onClick={() => setShowAnalytics((prev) => !prev)}
              title="Toggle Analytics Panel"
              style={{
                background: showAnalytics ? "rgba(0, 115, 187, 0.3)" : "rgba(12, 15, 22, 0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "10px",
                padding: "8px 12px",
                cursor: "pointer",
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: "13px",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="8" width="3" height="7" rx="1" fill="currentColor" opacity="0.6" />
                <rect x="5.5" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.7" />
                <rect x="10" y="2" width="3" height="13" rx="1" fill="currentColor" opacity="0.9" />
              </svg>
              Analytics
            </button>
          </div>
          {showAnalytics && (
            <AnalyticsPanel onClose={() => setShowAnalytics(false)} />
          )}
          <StatusDisplay
            imageRequestStatus={imageRequestStatus}
            setImageRequestStatus={setImageRequestStatus}
          />
          {featurePopupData && (
            <FeaturePopup
              data={featurePopupData}
              onClose={() => setFeaturePopupData(null)}
            />
          )}
        </AnalyticsProvider>
      </ResourceProvider>
    </ResiumViewer>
    </>
  );
};

export default App;
