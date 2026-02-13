// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Custom hook that auto-loads image processing results once a job succeeds.
 *
 * Extracted from ImageRequestModal to reduce the modal's complexity and
 * isolate the result-loading side-effect into a testable unit.
 */

import React, { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

import { FeatureCollectionResource, LoadedResource } from "@/context/ResourceContext";
import type { ImageRequestOutput, ImageRequestState } from "@/types";
import { loadS3GeoJson, type FeaturePopupCallback } from "@/utils/cesiumHelper";

/**
 * Loads GeoJSON results from S3 for each output and registers them as resources.
 */
async function loadResults(
  cesium: { viewer: import("cesium").Viewer },
  outputs: ImageRequestOutput[],
  jobName: string,
  jobId: string,
  resultsColor: string,
  setShowCredsExpiredAlert: (show: boolean) => void,
  setImageRequestStatus: React.Dispatch<React.SetStateAction<ImageRequestState>>,
  addResource?: (resource: LoadedResource) => void,
  onFeatureClick?: FeaturePopupCallback
) {
  let totalFeatures = 0;
  for (const output of outputs) {
    if (output.type === "S3") {
      const s3Object = `${jobName}/${jobId}.geojson`;
      const result = await loadS3GeoJson(
        cesium,
        output.bucket,
        s3Object,
        resultsColor,
        setShowCredsExpiredAlert,
        onFeatureClick
      );
      totalFeatures += result.featureCount;
      if (addResource) {
        addResource({
          id: uuidv4(),
          name: `${jobName} results`,
          type: "feature-collection",
          source: "s3",
          sourceDetail: `${output.bucket}/${s3Object}`,
          featureCount: result.featureCount,
          color: resultsColor,
          visible: true,
          loadedAt: new Date(),
          dataSource: result.dataSource
        } as FeatureCollectionResource);
      }
    }
  }
  setImageRequestStatus((prev: ImageRequestState) => ({
    ...prev,
    data: { ...prev.data, featureCount: totalFeatures }
  }));
}

export interface UseImageRequestResultsOptions {
  /** The Cesium viewer reference, or undefined if not ready. */
  viewer: import("cesium").Viewer | undefined;
  /** Current image request state. */
  imageRequestStatus: ImageRequestState;
  setImageRequestStatus: React.Dispatch<React.SetStateAction<ImageRequestState>>;
  /** Color to use when rendering result features. */
  resultsColor: string;
  setShowCredsExpiredAlert: (show: boolean) => void;
  addResource: (resource: LoadedResource) => void;
  onFeatureClick?: FeaturePopupCallback;
}

/**
 * Watches `imageRequestStatus.state` and auto-loads results when it
 * transitions to "success". Only loads once (skips if featureCount is set).
 */
export function useImageRequestResults({
  viewer,
  imageRequestStatus,
  setImageRequestStatus,
  resultsColor,
  setShowCredsExpiredAlert,
  addResource,
  onFeatureClick
}: UseImageRequestResultsOptions): void {
  useEffect(() => {
    const getData = async (
      cesiumRef: { viewer: import("cesium").Viewer },
      outputs: ImageRequestOutput[],
      jobName: string,
      jobId: string
    ) => {
      if (!imageRequestStatus.data.featureCount) {
        await loadResults(
          cesiumRef,
          outputs,
          jobName,
          jobId,
          resultsColor,
          setShowCredsExpiredAlert,
          setImageRequestStatus,
          addResource,
          onFeatureClick
        );
      }
    };

    const { outputs, jobName, jobId } = imageRequestStatus.data;
    if (imageRequestStatus.state === "success" && viewer && outputs && jobName && jobId) {
      getData({ viewer }, outputs, jobName, jobId);
    }
  }, [
    imageRequestStatus.state,
    viewer,
    resultsColor,
    setShowCredsExpiredAlert,
    setImageRequestStatus,
    addResource,
    onFeatureClick,
    imageRequestStatus.data
  ]);
}
