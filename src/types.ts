// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/* ──────────────────────────────────────────────────────────────────────
   Image Processing Output Types
   ────────────────────────────────────────────────────────────────────── */

export interface S3Output {
  type: "S3";
  bucket: string;
  prefix: string;
}

export interface KinesisOutput {
  type: "Kinesis";
  stream: string;
  batchSize: number;
}

export type ImageRequestOutput = S3Output | KinesisOutput;

/* ──────────────────────────────────────────────────────────────────────
   Image Processor Configuration
   ────────────────────────────────────────────────────────────────────── */

export interface ImageProcessor {
  name: string;
  type: string;
  assumedRole: string;
}

export interface FeatureDistillationConfig {
  algorithmType: string;
  iouThreshold: number;
  skipBoxThreshold?: number;
  sigma?: number;
}

export interface PostProcessingStep {
  step: string;
  algorithm: FeatureDistillationConfig;
}

/* ──────────────────────────────────────────────────────────────────────
   Image Request Status (used by App, modals, and status display)
   ────────────────────────────────────────────────────────────────────── */

export interface ImageRequestData {
  outputs?: ImageRequestOutput[];
  jobId?: string;
  jobName?: string;
  processingDuration?: string;
  featureCount?: number;
}

export interface ImageRequestState {
  state: string;
  data: ImageRequestData;
}
