// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Electron environment type declarations for Vite process variables. */

/// <reference types="vite-electron-plugin/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG?: 'true'
    DIST_ELECTRON: string
    DIST: string
    /** /dist/ or /public/ */
    PUBLIC: string
  }
}
