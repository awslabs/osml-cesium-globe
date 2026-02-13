// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Application entry point. Mounts the React app into the DOM
 * and configures Cesium Ion settings.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import * as Cesium from "cesium";

import App from "./App";

// Disable Cesium Ion services to prevent 401 errors
// This application uses local imagery and doesn't need Cesium Ion cloud services
Cesium.Ion.defaultAccessToken = "";
Cesium.Ion.defaultServer = "";

// Root element.
const rootElement: HTMLElement | null = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

// Mount the React app into the root DOM element
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Signal the loading screen to dismiss
window.postMessage({ payload: "removeLoading" }, "*");
