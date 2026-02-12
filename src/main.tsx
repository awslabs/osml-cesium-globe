// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * @file This file is the entry point of the React application.
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

/**
 * @description Responsible for rendering
 * the entire React application to the DOM
 */
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * @description Dispatch a postMessage
 * event to any listening window with the given payload
 */
window.postMessage({ payload: "removeLoading" }, "*");
