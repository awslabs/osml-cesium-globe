// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Shared TypeScript types for image processing requests, outputs, and job status. */

/* ──────────────────────────────────────────────────────────────────────
   Image Processing Output Types
   ────────────────────────────────────────────────────────────────────── */

/** S3 output destination for image processing results. */
export interface S3Output {
  type: "S3";
  bucket: string;
  prefix: string;
}

/** Kinesis stream output destination for image processing results. */
export interface KinesisOutput {
  type: "Kinesis";
  stream: string;
  batchSize: number;
}

export type ImageRequestOutput = S3Output | KinesisOutput;

/* ──────────────────────────────────────────────────────────────────────
   Image Processor Configuration
   ────────────────────────────────────────────────────────────────────── */

/** Configuration for the SageMaker model endpoint used to process images. */
export interface ImageProcessor {
  name: string;
  type: string;
  assumedRole: string;
}

/** Parameters for post-processing feature distillation algorithms. */
export interface FeatureDistillationConfig {
  algorithmType: string;
  iouThreshold: number;
  skipBoxThreshold?: number;
  sigma?: number;
}

/** A single post-processing step applied after image inference. */
export interface PostProcessingStep {
  step: string;
  algorithm: FeatureDistillationConfig;
}

/* ──────────────────────────────────────────────────────────────────────
   Image Request Status (used by App, modals, and status display)
   ────────────────────────────────────────────────────────────────────── */

/** Metadata about an image processing job's progress and results. */
export interface ImageRequestData {
  outputs?: ImageRequestOutput[];
  jobId?: string;
  jobName?: string;
  processingDuration?: string;
  featureCount?: number;
}

/** Current state of an image processing request (used by App, modals, and status display). */
export interface ImageRequestState {
  state: string;
  data: ImageRequestData;
}
