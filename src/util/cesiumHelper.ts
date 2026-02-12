// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { exec } from "node:child_process";

import * as Cesium from "cesium";
import { Color, GeoJsonDataSource, Viewer, ImageryLayer } from "cesium";
import fs from "fs";
import path from "path";
import * as uuid from "uuid";

import {
  CESIUM_IMAGERY_TILES_FOLDER,
  DEFAULT_RESULTS_FILL_ALPHA,
  DEFAULT_RESULTS_LINE_ALPHA,
  LOCAL_GEOJSON_FOLDER,
  LOCAL_IMAGE_DATA_FOLDER,
  ZOOM_MAX,
  ZOOM_MIN
} from "@/config";
import { loadS3Object } from "@/util/s3Helper";

interface CesiumRectDeg {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface ImageRequestError extends Error {
  code?: string;
}

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
 * Loads a GeoJSON data source into the Cesium viewer
 * @param map - The Cesium viewer instance
 * @param mapData - The GeoJSON data as a string
 * @param jobId - Unique identifier for the data source
 * @param resultsColor - Color for the features
 * @param onFeatureClick - Optional callback invoked when a feature is clicked
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
      fill: Color.fromCssColorString(resultsColor).withAlpha(
        DEFAULT_RESULTS_FILL_ALPHA
      ),
      stroke: Color.fromCssColorString(resultsColor).withAlpha(
        DEFAULT_RESULTS_LINE_ALPHA
      ),
      clampToGround: true
    });
    geojson.name = jobId;
    await map.dataSources.add(geojson);
    await map.zoomTo(geojson);

    // Add click handler for the GeoJSON features
    map.screenSpaceEventHandler.setInputAction((click: any) => {
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
          console.error("Error handling feature click:", error);
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
    console.error("Error loading GeoJSON:", error);
    throw new Error("Failed to load GeoJSON data");
  }
}

/**
 * A single key-value entry in a property group.
 * Nested objects are represented as children instead of a flat string.
 */
export interface PropertyEntry {
  key: string;
  value: string;
  /** Nested sub-entries for object values */
  children?: PropertyEntry[];
}

/**
 * A named group of property entries.
 */
export interface PropertyGroup {
  group: string;
  entries: PropertyEntry[];
}

/**
 * Formats feature properties into structured groups for display.
 * @param properties - The raw feature properties
 * @returns An array of PropertyGroup objects
 */
export function formatFeatureProperties(properties: Record<string, any>): PropertyGroup[] {
  const GROUPS: Record<string, string[]> = {
    CLASSIFICATION: ['class', 'feature', 'score', 'confidence'],
    LOCATION: ['longitude', 'latitude', 'altitude', 'height', 'width'],
    METADATA: ['inference', 'date', 'time', 'timestamp', 'version']
  };

  const SKIP_PROPERTIES = [
    'coordinates', 'geometry', 'type', 'id', 'center longitude', 'center latitude',
    'bbox', 'bounds', 'shape'
  ];

  const SENSITIVE_PROPERTIES = ['password', 'secret', 'key', 'token'];
  const MAX_VALUE_LENGTH = 100;

  const grouped: Record<string, PropertyEntry[]> = {
    CLASSIFICATION: [],
    LOCATION: [],
    METADATA: [],
    OTHER: []
  };

  /** Format a primitive/scalar value into a display string. */
  const formatScalar = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';

    if (typeof value === 'number') {
      if (value > 0.99 || value < -0.99) {
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
      }
      return value.toFixed(4);
    }

    if (value instanceof Date || (typeof value === 'string' && value.includes('202'))) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date.toLocaleString();
      } catch { /* keep original */ }
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '';
      if (typeof value[0] === 'number' || Array.isArray(value[0])) return '';
      return value.map(v => formatScalar(v)).filter(v => v !== '').join(', ');
    }

    // Objects: flatten key-value pairs into a readable string
    if (typeof value === 'object') {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        const fk = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ').trim();
        parts.push(`${fk}: ${formatScalar(v)}`);
      }
      return parts.join(', ') || 'N/A';
    }

    return String(value);
  };

  const formatKey = (k: string): string =>
    k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ').trim();

  /** Convert a value into a PropertyEntry, expanding nested objects/arrays into children. */
  const toEntry = (key: string, value: any, depth: number = 0): PropertyEntry | null => {
    if (value === null || value === undefined) return { key, value: 'N/A' };

    // Nested objects become entries with children
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (depth >= 3) return { key, value: formatScalar(value) };

      const children: PropertyEntry[] = [];
      for (const [k, v] of Object.entries(value)) {
        if (SKIP_PROPERTIES.some(p => k.toLowerCase().includes(p.toLowerCase()))) continue;
        if (SENSITIVE_PROPERTIES.some(p => k.toLowerCase().includes(p))) continue;
        const child = toEntry(formatKey(k), v, depth + 1);
        if (child) children.push(child);
      }
      if (children.length === 0) return null;
      return { key, value: '', children };
    }

    // Arrays of objects: each element becomes a numbered child with its own sub-entries
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      if (typeof value[0] === 'number' || Array.isArray(value[0])) return null;

      // If elements are objects, expand into numbered children
      if (typeof value[0] === 'object') {
        if (depth >= 3) return { key, value: formatScalar(value) };

        const children: PropertyEntry[] = [];
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          const itemLabel = value.length === 1 ? key : `${key} ${i + 1}`;
          const child = toEntry(itemLabel, item, depth + 1);
          if (child) children.push(child);
        }
        // If single-element array, just hoist the children up
        if (children.length === 1 && children[0].children) {
          return { key, value: '', children: children[0].children };
        }
        if (children.length === 0) return null;
        return { key, value: '', children };
      }

      // Array of scalars
      const formatted = value.map(v => formatScalar(v)).filter(v => v !== '').join(', ');
      return formatted ? { key, value: formatted } : null;
    }

    const formatted = formatScalar(value);
    if (formatted === '') return null;
    return { key, value: formatted };
  };

  const getGroup = (key: string): string => {
    const lower = key.toLowerCase();
    for (const [group, keywords] of Object.entries(GROUPS)) {
      if (keywords.some(kw => lower.includes(kw))) return group;
    }
    return 'OTHER';
  };

  for (const [key, value] of Object.entries(properties)) {
    if (SKIP_PROPERTIES.some(p => key.toLowerCase().includes(p.toLowerCase()))) continue;
    if (SENSITIVE_PROPERTIES.some(p => key.toLowerCase().includes(p))) continue;
    if (Array.isArray(value) && value.length > 0 && (typeof value[0] === 'number' || Array.isArray(value[0]))) continue;

    let displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ').trim();
    if (displayKey.toLowerCase().includes('dt')) displayKey = displayKey.replace('DT', 'Date/Time');
    if (displayKey.toLowerCase().includes('inference metadata')) displayKey = 'Inference Time';
    if (displayKey.toLowerCase().includes('inference d t')) displayKey = 'Inference Time';

    // Special case: feature_classes -> extract IRI + Score into CLASSIFICATION
    if (displayKey === 'Feature Classes' && typeof value === 'object') {
      const items = Array.isArray(value) ? value : [value];
      let handled = false;
      for (const item of items) {
        if (item && typeof item === 'object') {
          const iri = item.iri || item.Iri || item.IRI;
          const score = item.score || item.Score;
          if (iri !== undefined) {
            grouped['CLASSIFICATION'].push({ key: 'IRI', value: String(iri) });
          }
          if (score !== undefined) {
            grouped['CLASSIFICATION'].push({ key: 'Score', value: formatScalar(score) });
          }
          if (iri !== undefined || score !== undefined) handled = true;
          // Add any remaining keys as children
          const otherChildren: PropertyEntry[] = [];
          for (const [k, v] of Object.entries(item)) {
            if (['iri', 'score'].includes(k.toLowerCase())) continue;
            const child = toEntry(formatKey(k), v, 1);
            if (child) otherChildren.push(child);
          }
          if (otherChildren.length > 0) {
            grouped['CLASSIFICATION'].push(...otherChildren);
          }
        }
      }
      if (handled) continue;
    }

    const entry = toEntry(displayKey, value);
    if (!entry) continue;

    // Truncate flat values
    if (entry.value && entry.value.length > MAX_VALUE_LENGTH) {
      entry.value = entry.value.substring(0, MAX_VALUE_LENGTH) + '...';
    }

    // Clean up inference time value
    if (displayKey === 'Inference Time' && entry.value.includes('Inference D T:')) {
      entry.value = entry.value.replace('Inference D T:', '').trim();
    }

    grouped[getGroup(key)].push(entry);
  }

  // Return only non-empty groups, in order
  return Object.entries(grouped)
    .filter(([, entries]) => entries.length > 0)
    .map(([group, entries]) => ({ group, entries }));
}

/**
 * Adds an image layer to the Cesium viewer with pre-calculated extents
 * @param map - The Cesium viewer instance
 * @param tileUrl - URL template for the image tiles
 * @param imageId - Unique identifier for the image
 * @param extents - Pre-calculated geographic extents
 * @param setShowCredsExpiredAlert - Callback to show credentials expired alert
 */
async function addImageLayerWithExtents(
  map: Viewer,
  tileUrl: string,
  imageId: string,
  extents: CesiumRectDeg,
  setShowCredsExpiredAlert: (show: boolean) => void
): Promise<ImageryLayer | undefined> {
  try {
    // Wait for viewer to be initialized
    let retryCount = 0;
    const maxRetries = 20; // Increased max retries
    while (!map?.scene && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay
      retryCount++;
      console.log(`Waiting for viewer initialization... Attempt ${retryCount}/${maxRetries}`);
    }

    if (!map?.scene) {
      throw new Error("Cesium scene is not initialized after waiting");
    }

    // Additional check to ensure scene is fully ready
    if (!map.scene.imageryLayers) {
      throw new Error("Imagery layers not available in scene");
    }

    const layers = map.scene.imageryLayers;
    console.log("Adding image layer with extents:", extents);

    const rectangle = Cesium.Rectangle.fromDegrees(
      extents.west,
      extents.south,
      extents.east,
      extents.north
    );

    console.log("Loading imagery tiles into Cesium...");
    const imageryProvider = new Cesium.UrlTemplateImageryProvider({
      url: tileUrl,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      rectangle: rectangle,
      maximumLevel: ZOOM_MAX,
      minimumLevel: ZOOM_MIN,
      credit: imageId.split(":")[0]
    });

    const imageryLayer = layers.addImageryProvider(imageryProvider);
    console.log("Finished loading imagery tiles into Cesium!");

    // Wait a moment for the imagery to load, then zoom to the image extent
    setTimeout(() => {
      map.camera.flyTo({
        destination: rectangle,
        duration: 2.0 // 2 second animation
      });
      console.log("Zoomed to image extent!");
    }, 1000);

    return imageryLayer;
  } catch (error) {
    const err = error as ImageRequestError;
    if (err.code === "ExpiredToken") {
      setShowCredsExpiredAlert(true);
    } else {
      console.error("Error adding image layer:", error);
      throw error;
    }
    return undefined;
  }
}

/**
 * Stops and removes a Docker container
 * @param containerName - Name of the container to remove
 */
function stopAndRemoveContainer(containerName: string): void {
  exec(`docker stop ${containerName}`, (err, output) => {
    if (err) {
      console.error("Could not stop container:", err);
    } else {
      console.log("Stopped container:", output);
      exec(`docker rm ${containerName}`, (err, output) => {
        if (err) {
          console.error("Could not remove container:", err);
        } else {
          console.log("Removed container:", output);
        }
      });
    }
  });
}

/**
 * Converts an image to Cesium tiles
 * @param cesium - Cesium viewer instance
 * @param fileName - Name of the image file
 * @param imageId - Unique identifier for the image
 * @param setShowCredsExpiredAlert - Callback to show credentials expired alert
 */
export async function convertImageToCesium(
  cesium: { viewer: Viewer },
  fileName: string,
  imageId: string,
  setShowCredsExpiredAlert: (show: boolean) => void
): Promise<ImageryLayer | undefined> {
  fileName = fileName.replace(/^(\.\.(\/|\\|$))+/, "");
  const imageFolder = path.resolve(LOCAL_IMAGE_DATA_FOLDER);
  const tileFolder = path.resolve(CESIUM_IMAGERY_TILES_FOLDER);

  try {
    return await new Promise<ImageryLayer | undefined>((resolve, reject) => {
      exec("docker pull tumgis/ctb-quantized-mesh:alpine", async (err, output) => {
        if (err) {
          reject(new Error(`Failed to pull Docker image: ${err.message}`));
          return;
        }

        const jobName = "ctb-tile-creation-" + uuid.v4();
        exec(
          `docker run -d --name ${jobName} -v ${imageFolder}:/data/images/ -v ${tileFolder}:/data/tiles/ -v ${path.resolve(process.cwd(), "scripts")}:/data/scripts/ tumgis/ctb-quantized-mesh:alpine tail -f /dev/null`,
          async (err, output) => {
            if (err) {
              reject(new Error(`Failed to run Docker container: ${err.message}`));
              return;
            }

            // First install Python3, fix permissions, then calculate extents, then generate tiles
            exec(
              `docker exec ${jobName} sh -c "apk add --no-cache python3 >/dev/null 2>&1 && chmod -R 755 /data/images/ && chmod -R 755 /data/scripts/ && python3 /data/scripts/calculate_extents.py /data/images/${fileName}"`,
              async (err, extentsOutput) => {
                if (err) {
                  stopAndRemoveContainer(jobName);
                  reject(new Error(`Failed to calculate extents: ${err.message}`));
                  return;
                }

                try {
                  // Parse the extents from the first command
                  const extents = JSON.parse(extentsOutput.trim());
                  console.log("Successfully calculated extents:", extents);

                  // Now generate tiles
                  exec(
                    `docker exec ${jobName} sh -c "chmod -R 755 /data/tiles/ && ctb-tile -f PNG -R -C -N -s ${ZOOM_MAX} -e ${ZOOM_MIN} -t 256 -o /data/tiles /data/images/${fileName}"`,
                    async (err, output) => {
                      if (err) {
                        stopAndRemoveContainer(jobName);
                        reject(new Error(`Failed to create tiles: ${err.message}`));
                        return;
                      }

                      try {
                        // Add the image layer with the calculated extents
                        const tileBaseUrl = typeof window !== "undefined"
                          ? window.location.origin
                          : "http://localhost:5173";
                        const layer = await addImageLayerWithExtents(
                          cesium.viewer,
                          `${tileBaseUrl}/src/data/tiles/imagery/{z}/{x}/{reverseY}.png`,
                          imageId,
                          extents,
                          setShowCredsExpiredAlert
                        );
                        resolve(layer);
                      } catch (error) {
                        reject(error);
                      } finally {
                        stopAndRemoveContainer(jobName);
                      }
                    }
                  );
                } catch (parseError: unknown) {
                  stopAndRemoveContainer(jobName);
                  reject(new Error(`Failed to parse extents output: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
                }
              }
            );
          }
        );
      });
    });
  } catch (error) {
    console.error("Error converting image to Cesium:", error);
    throw error;
  }
}

/**
 * Loads an image into Cesium
 * @param cesium - Cesium viewer instance
 * @param bucket - S3 bucket name
 * @param s3Object - S3 object key
 * @param imageId - Unique identifier for the image
 * @param setShowCredsExpiredAlert - Callback to show credentials expired alert
 */
export async function loadImageInCesium(
  cesium: { viewer: Viewer },
  bucket: string,
  s3Object: string,
  imageId: string,
  setShowCredsExpiredAlert: (show: boolean) => void
): Promise<ImageryLayer | undefined> {
  const fileName = s3Object.split("/").pop();
  if (!fileName) {
    throw new Error("Invalid S3 object key");
  }

  const outFilePath = path.join(LOCAL_IMAGE_DATA_FOLDER, fileName);

  try {
    await new Promise<void>((resolve, reject) => {
      fs.open(outFilePath, "r", async (err) => {
        if (err) {
          const s3ImageObject = { name: s3Object, bucket: bucket, date: "" };
          console.log("Downloading image from S3...");

          const binData = await loadS3Object(
            s3ImageObject,
            setShowCredsExpiredAlert,
            true
          );

          if (!binData) {
            reject(new Error("Failed to download image from S3"));
            return;
          }

          fs.writeFile(outFilePath, binData, "binary", async (err) => {
            if (err) {
              reject(new Error(`Failed to write file: ${err.message}`));
              return;
            }
            console.log(`Successfully downloaded image to: ${outFilePath}!`);
            resolve();
          });
        } else {
          console.log(`${outFilePath} already exists!`);
          resolve();
        }
      });
    });

    return await convertImageToCesium(
      cesium,
      fileName,
      imageId,
      setShowCredsExpiredAlert
    );
  } catch (error) {
    console.error("Error loading image in Cesium:", error);
    throw error;
  }
}

/**
 * Loads GeoJSON data from S3 into Cesium
 * @param cesium - Cesium viewer instance
 * @param bucket - S3 bucket name
 * @param s3Object - S3 object key
 * @param resultsColor - Color for the features
 * @param setShowCredsExpiredAlert - Callback to show credentials expired alert
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
    const mapData = await loadS3Object(
      s3ResultsObject,
      setShowCredsExpiredAlert
    );

    if (typeof mapData !== "string") {
      throw new Error("Invalid GeoJSON data received from S3");
    }

    await new Promise<void>((resolve, reject) => {
      fs.open(outFilePath, "r", async (err) => {
        if (err) {
          console.log("Downloading results from S3...");
          fs.writeFile(outFilePath, mapData, async (err) => {
            if (err) {
              reject(new Error(`Failed to write file: ${err.message}`));
              return;
            }
            console.log(`Successfully downloaded results to: ${outFilePath}!`);
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
    console.log(`Successfully loaded results for: ${fileName}!`);
    return result;
  } catch (error) {
    console.error("Error loading S3 GeoJSON:", error);
    throw error;
  }
}

/**
 * Unloads all GeoJSON features from the Cesium viewer
 * @param map - The Cesium viewer instance
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
    console.error("Error unloading GeoJSON features:", error);
    throw error;
  }
}
