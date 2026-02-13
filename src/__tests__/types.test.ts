// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Type-level tests to ensure our shared types are correct.
 * These tests verify compile-time constraints rather than runtime behavior.
 */

import type {
  ImageRequestState,
  ImageRequestData,
  ImageRequestOutput,
  S3Output,
  KinesisOutput,
  ImageProcessor,
  FeatureDistillationConfig,
  PostProcessingStep
} from "@/types";

describe("types", () => {
  it("ImageRequestState accepts valid state", () => {
    const state: ImageRequestState = {
      state: "idle",
      data: {}
    };
    expect(state.state).toBe("idle");
    expect(state.data).toEqual({});
  });

  it("ImageRequestData accepts all optional fields", () => {
    const data: ImageRequestData = {
      outputs: [{ type: "S3", bucket: "test", prefix: "job/" }],
      jobId: "123",
      jobName: "test_123",
      processingDuration: "5",
      featureCount: 42
    };
    expect(data.featureCount).toBe(42);
  });

  it("ImageRequestOutput discriminates correctly", () => {
    const s3: S3Output = { type: "S3", bucket: "b", prefix: "p/" };
    const kinesis: KinesisOutput = { type: "Kinesis", stream: "s", batchSize: 100 };
    const outputs: ImageRequestOutput[] = [s3, kinesis];

    expect(outputs[0].type).toBe("S3");
    expect(outputs[1].type).toBe("Kinesis");
  });

  it("ImageProcessor has required fields", () => {
    const proc: ImageProcessor = {
      name: "my-model",
      type: "SM_ENDPOINT",
      assumedRole: "arn:aws:iam::123:role/test"
    };
    expect(proc.name).toBe("my-model");
  });

  it("FeatureDistillationConfig supports NMS variant", () => {
    const nms: FeatureDistillationConfig = {
      algorithmType: "NMS",
      iouThreshold: 0.5
    };
    expect(nms.algorithmType).toBe("NMS");
  });

  it("FeatureDistillationConfig supports SOFT_NMS variant", () => {
    const softNms: FeatureDistillationConfig = {
      algorithmType: "SOFT_NMS",
      iouThreshold: 0.5,
      skipBoxThreshold: 0.2,
      sigma: 0.1
    };
    expect(softNms.sigma).toBe(0.1);
  });

  it("PostProcessingStep wraps distillation config", () => {
    const step: PostProcessingStep = {
      step: "FEATURE_DISTILLATION",
      algorithm: {
        algorithmType: "NMS",
        iouThreshold: 0.3
      }
    };
    expect(step.algorithm.algorithmType).toBe("NMS");
  });
});
