// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * GeoJSON feature loading and click handling for Cesium.
 * Manages data sources, feature click interactions, and S3-based GeoJSON loading.
 */

import * as Cesium from "cesium";
import { Color, GeoJsonDataSource, Viewer } from "cesium";
import fs from "fs";
import path from "path";

import {
  DEFAULT_RESULTS_FILL_ALPHA,
  DEFAULT_RESULTS_LINE_ALPHA,
  LOCAL_GEOJSON_FOLDER
} from "@/config";
import { formatFeatureProperties, type PropertyGroup } from "@/utils/cesiumFormatters";
import { logger } from "@/utils/logger";
import { loadS3Object } from "@/utils/s3Helper";

/**
 * Callback for feature popup display.
 * Pass null to dismiss the popup.
 */
export type FeaturePopupCallback = (data: {
  position: Cesium.Cartesian3;
  properties: PropertyGroup[];
  color: string;
} | null) => void;

/**
 * Loads a GeoJSON data source into the Cesium viewer.
 */
export async function loadGeoJson(
  map: Viewer,
  mapData: string,
  jobId: string,
  resultsColor: string,
  onFeatureClick?: FeaturePopupCallback
): Promise<{ dataSource: GeoJsonDataSource; featureCount: number }> {
  try {
    const geojsonData = JSON.parse(mapData);
    const featureCount = geojsonData.features?.length || 0;

    const geojson = await GeoJsonDataSource.load(geojsonData, {
      fill: Color.fromCssColorString(resultsColor).withAlpha(DEFAULT_RESULTS_FILL_ALPHA),
      stroke: Color.fromCssColorString(resultsColor).withAlpha(DEFAULT_RESULTS_LINE_ALPHA),
      clampToGround: true
    });
    geojson.name = jobId;
    await map.dataSources.add(geojson);
    await map.zoomTo(geojson);

    // Add click handler for the GeoJSON features
    map.screenSpaceEventHandler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const pickedObject = map.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        try {
          // Remove any existing billboard markers
          const entities = map.entities.values;
          for (let i = entities.length - 1; i >= 0; i--) {
            if (entities[i].billboard) map.entities.remove(entities[i]);
          }

          const entity = pickedObject.id;

          // Get the position from the entity
          let position: Cesium.Cartesian3 | undefined;
          if (entity.position) {
            position = entity.position.getValue(Cesium.JulianDate.now());
          } else if (entity.polygon) {
            const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
            const positions = hierarchy.positions;
            if (positions && positions.length > 0) {
              let sumX = 0, sumY = 0, sumZ = 0;
              for (let i = 0; i < positions.length; i++) {
                sumX += positions[i].x;
                sumY += positions[i].y;
                sumZ += positions[i].z;
              }
              position = new Cesium.Cartesian3(
                sumX / positions.length,
                sumY / positions.length,
                sumZ / positions.length
              );
            }
          } else if (entity.polyline) {
            const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
            if (positions && positions.length > 0) position = positions[0];
          }

          if (position) {
            // Get properties
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const propertyValues: Record<string, any> = {};
            if (entity.properties) {
              const props = entity.properties.getValue(Cesium.JulianDate.now());
              if (props) Object.assign(propertyValues, props);
            }

            // Add a small billboard marker at the click position
            map.entities.add({
              position,
              billboard: {
                image: 'data:image/svg+xml;base64,' + btoa(
                  `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">` +
                  `<circle cx="16" cy="16" r="14" fill="${resultsColor}" opacity="0.8"/>` +
                  `<circle cx="16" cy="16" r="8" fill="white"/>` +
                  `</svg>`
                ),
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                scale: 1.0
              }
            });

            // Call the React callback with structured data
            if (onFeatureClick) {
              onFeatureClick({
                position,
                properties: formatFeatureProperties(propertyValues),
                color: resultsColor
              });
            }
          }
        } catch (error) {
          logger.error("Error handling feature click:", error);
        }
      } else {
        // Click on empty space - dismiss popup and remove billboards
        const entities = map.entities.values;
        for (let i = entities.length - 1; i >= 0; i--) {
          if (entities[i].billboard) map.entities.remove(entities[i]);
        }
        if (onFeatureClick) onFeatureClick(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return { dataSource: geojson, featureCount };
  } catch (error) {
    logger.error("Error loading GeoJSON:", error);
    throw new Error("Failed to load GeoJSON data");
  }
}

/**
 * Loads GeoJSON data from S3 into Cesium.
 */
export async function loadS3GeoJson(
  cesium: { viewer: Viewer },
  bucket: string,
  s3Object: string,
  resultsColor: string,
  setShowCredsExpiredAlert: (show: boolean) => void,
  onFeatureClick?: FeaturePopupCallback
): Promise<{ dataSource: GeoJsonDataSource; featureCount: number }> {
  const fileName = s3Object.split("/").pop();
  if (!fileName) {
    throw new Error("Invalid S3 object key");
  }

  const outFilePath = path.join(LOCAL_GEOJSON_FOLDER, fileName);
  const s3ResultsObject = { name: s3Object, bucket: bucket, date: "" };

  try {
    const mapData = await loadS3Object(s3ResultsObject, setShowCredsExpiredAlert);

    if (typeof mapData !== "string") {
      throw new Error("Invalid GeoJSON data received from S3");
    }

    await new Promise<void>((resolve, reject) => {
      fs.open(outFilePath, "r", async (err) => {
        if (err) {
          logger.info("Downloading results from S3...");
          fs.writeFile(outFilePath, mapData, async (err) => {
            if (err) {
              reject(new Error(`Failed to write file: ${err.message}`));
              return;
            }
            logger.info(`Successfully downloaded results to: ${outFilePath}`);
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    const splitName = s3Object.split(".")[0].split("/");
    const result = await loadGeoJson(
      cesium.viewer,
      mapData,
      splitName[splitName.length - 1],
      resultsColor,
      onFeatureClick
    );
    logger.info(`Successfully loaded results for: ${fileName}`);
    return result;
  } catch (error) {
    logger.error("Error loading S3 GeoJSON:", error);
    throw error;
  }
}

/**
 * Unloads all GeoJSON features from the Cesium viewer.
 */
export async function unloadAllGeoJsonFeatures(map: Viewer): Promise<void> {
  try {
    const dataSources = map.dataSources;
    for (let i = 0; i < dataSources.length; i++) {
      const dataSource = dataSources.get(i);
      if (dataSource instanceof GeoJsonDataSource) {
        await dataSources.remove(dataSource);
      }
    }
  } catch (error) {
    logger.error("Error unloading GeoJSON features:", error);
    throw error;
  }
}
