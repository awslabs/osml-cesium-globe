// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import "./styles.css";

import React, { useState, useMemo } from "react";
import { Viewer } from "resium";
import Cesium from "cesium";

import OsmlTray from "@/components/OsmlTray";
import StatusDisplay from "@/components/StatusDisplay";
import Logo from "@/components/Logo";
import { generateImageryProviders } from "@/util/imageryProviders";

const App = () => {
  const [imageRequestStatus, setImageRequestStatus] = useState({
    state: "idle",
    data: {}
  });

  // Memoize the imagery providers to prevent recreation
  const imageryProviders = useMemo(() => generateImageryProviders(), []);

  return (
    <Viewer
      full
      imageryProviderViewModels={imageryProviders}
      selectedImageryProviderViewModel={imageryProviders[0]}
      // terrainProviderViewModels={generateTerrainProviders()}
    >
      <Logo />
      <OsmlTray
        imageRequestStatus={imageRequestStatus}
        setImageRequestStatus={setImageRequestStatus}
      />
      <StatusDisplay
        imageRequestStatus={imageRequestStatus}
        setImageRequestStatus={setImageRequestStatus}
      />
      {/*<Scene>*/}
      {/*  <Globe terrainExaggeration={1.5}></Globe>*/}
      {/*</Scene>*/}
    </Viewer>
  );
};

export default App;
