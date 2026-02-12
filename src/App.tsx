// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import "./styles.css";

import React, { useState, useEffect, useCallback } from "react";
import { Viewer as ResiumViewer, CesiumComponentRef } from "resium";
import * as Cesium from "cesium";

import OsmlTray from "@/components/OsmlTray";
import StatusDisplay from "@/components/StatusDisplay";
import Logo from "@/components/Logo";
import { ResourceProvider } from "@/context/ResourceContext";

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
  const [imageRequestStatus, setImageRequestStatus] = useState({
    state: "idle",
    data: {}
  });

  const [baseLayer, setBaseLayer] = useState<Cesium.ImageryLayer | null>(null);

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
        <Logo />
        <OsmlTray
          imageRequestStatus={imageRequestStatus}
          setImageRequestStatus={setImageRequestStatus}
        />
        <StatusDisplay
          imageRequestStatus={imageRequestStatus}
          setImageRequestStatus={setImageRequestStatus}
        />
      </ResourceProvider>
    </ResiumViewer>
  );
};

export default App;
