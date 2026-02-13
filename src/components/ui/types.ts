// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Shared types for dark-themed form controls */

export type LoadingStatus = "pending" | "loading" | "finished" | "error";

export interface OptionItem {
  value: string;
  label?: string;
}

export interface LabeledOption {
  label: string;
  value: string;
}
