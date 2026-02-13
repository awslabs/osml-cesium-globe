// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Jest test runner configuration with ts-jest and path alias support. */

/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        diagnostics: false
      }
    ]
  },
  // Ignore CSS imports in tests
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"]
};

module.exports = config;
