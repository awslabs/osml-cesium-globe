// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Image/imagery loading and tile generation utilities for Cesium.
 * Handles S3 image downloads, Docker-based tile creation, and imagery layer management.
 */

import { exec } from "node:child_process";

import * as Cesium from "cesium";
import { ImageryLayer, Viewer } from "cesium";
import fs from "fs";
import path from "path";
import * as uuid from "uuid";

import {
  CAMERA_FLY_DELAY_MS,
  CAMERA_FLY_DURATION_SECONDS,
  CESIUM_IMAGERY_TILES_FOLDER,
  FALLBACK_DEV_URL,
  LOCAL_IMAGE_DATA_FOLDER,
  VIEWER_INIT_MAX_RETRIES,
  VIEWER_INIT_RETRY_DELAY_MS,
  ZOOM_MAX,
  ZOOM_MIN
} from "@/config";
import { logger } from "@/utils/logger";
import { loadS3Object } from "@/utils/s3Helper";

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
 * Adds an image layer to the Cesium viewer with pre-calculated extents.
 */
async function addImageLayerWithExtents(
  map: Viewer,
  tileUrl: string,
  imageId: string,
  extents: CesiumRectDeg,
  setShowCredsExpiredAlert: (show: boolean) => void
): Promise<ImageryLayer | undefined> {
  try {
    let retryCount = 0;
    while (!map?.scene && retryCount < VIEWER_INIT_MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, VIEWER_INIT_RETRY_DELAY_MS));
      retryCount++;
      logger.debug(`Waiting for viewer initialization... Attempt ${retryCount}/${VIEWER_INIT_MAX_RETRIES}`);
    }

    if (!map?.scene) {
      throw new Error("Cesium scene is not initialized after waiting");
    }

    if (!map.scene.imageryLayers) {
      throw new Error("Imagery layers not available in scene");
    }

    const layers = map.scene.imageryLayers;
    logger.info("Adding image layer with extents:", extents);

    const rectangle = Cesium.Rectangle.fromDegrees(
      extents.west,
      extents.south,
      extents.east,
      extents.north
    );

    logger.info("Loading imagery tiles into Cesium...");
    const imageryProvider = new Cesium.UrlTemplateImageryProvider({
      url: tileUrl,
      tilingScheme: new Cesium.GeographicTilingScheme(),
      rectangle: rectangle,
      maximumLevel: ZOOM_MAX,
      minimumLevel: ZOOM_MIN,
      credit: imageId.split(":")[0]
    });

    const imageryLayer = layers.addImageryProvider(imageryProvider);
    logger.info("Finished loading imagery tiles into Cesium!");

    setTimeout(() => {
      map.camera.flyTo({
        destination: rectangle,
        duration: CAMERA_FLY_DURATION_SECONDS
      });
      logger.debug("Zoomed to image extent");
    }, CAMERA_FLY_DELAY_MS);

    return imageryLayer;
  } catch (error) {
    const err = error as ImageRequestError;
    if (err.code === "ExpiredToken") {
      setShowCredsExpiredAlert(true);
    } else {
      logger.error("Error adding image layer:", error);
      throw error;
    }
    return undefined;
  }
}

/**
 * Stops and removes a Docker container.
 */
function stopAndRemoveContainer(containerName: string): void {
  exec(`docker stop ${containerName}`, (err, output) => {
    if (err) {
      logger.error("Could not stop container:", err);
    } else {
      logger.debug("Stopped container:", output);
      exec(`docker rm ${containerName}`, (err, output) => {
        if (err) {
          logger.error("Could not remove container:", err);
        } else {
          logger.debug("Removed container:", output);
        }
      });
    }
  });
}

/**
 * Removes the temporary warped image file created during preprocessing.
 */
function cleanupWarpedFile(warpedFilePath: string): void {
  fs.unlink(warpedFilePath, (err) => {
    if (err && err.code !== "ENOENT") {
      logger.error("Could not remove warped file:", err);
    } else {
      logger.debug("Removed warped file:", warpedFilePath);
    }
  });
}

/**
 * Returns the path to the extents metadata file inside a tile cache directory.
 */
function getExtentsMetadataPath(tileCacheDir: string): string {
  return path.join(tileCacheDir, ".extents.json");
}

/**
 * Checks if valid cached tiles and extents exist for a given tile cache directory.
 * Returns the cached extents if found, or null if no valid cache exists.
 */
function getCachedExtents(tileCacheDir: string): CesiumRectDeg | null {
  const metadataPath = getExtentsMetadataPath(tileCacheDir);
  try {
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    if (
      data.west === undefined ||
      data.south === undefined ||
      data.east === undefined ||
      data.north === undefined
    ) {
      return null;
    }

    // Verify at least one zoom-level directory exists alongside the metadata
    const entries = fs.readdirSync(tileCacheDir);
    const hasZoomDirs = entries.some(entry => /^\d+$/.test(entry));
    if (!hasZoomDirs) {
      return null;
    }

    logger.info("Found cached tiles with extents:", data);
    return data as CesiumRectDeg;
  } catch (err) {
    logger.debug("No valid tile cache found:", err);
    return null;
  }
}

/**
 * Persists extents metadata alongside cached tiles for future reuse.
 */
function saveCachedExtents(tileCacheDir: string, extents: CesiumRectDeg): void {
  const metadataPath = getExtentsMetadataPath(tileCacheDir);
  try {
    fs.mkdirSync(tileCacheDir, { recursive: true });
    fs.writeFileSync(metadataPath, JSON.stringify(extents, null, 2), "utf-8");
    logger.debug("Saved tile cache metadata:", metadataPath);
  } catch (err) {
    logger.error("Failed to save tile cache metadata:", err);
  }
}

/**
 * Converts a local image to Cesium tiles using Docker-based ctb-tile.
 * Images are first warped to EPSG:4326 via gdalwarp to handle projected
 * coordinate systems and rotation before tiling.
 *
 * @param cesium - Cesium viewer wrapper.
 * @param fileName - Name of the image file in the local images folder.
 * @param imageId - Unique identifier for the image (used for credit attribution).
 * @param setShowCredsExpiredAlert - Callback to surface credential expiry to the UI.
 * @returns The added imagery layer, or undefined on failure.
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
  const baseName = path.parse(fileName).name;
  const tileCacheDir = path.join(tileFolder, baseName);
  const warpedFileName = "_warped.tif";
  const warpedFilePath = path.join(imageFolder, warpedFileName);

  // Check for cached tiles before running the Docker pipeline
  const cachedExtents = getCachedExtents(tileCacheDir);
  if (cachedExtents) {
    logger.info("Using cached tiles for:", fileName);
    const tileBaseUrl = typeof window !== "undefined"
      ? window.location.origin
      : FALLBACK_DEV_URL;
    return addImageLayerWithExtents(
      cesium.viewer,
      `${tileBaseUrl}/src/data/tiles/imagery/${baseName}/{z}/{x}/{reverseY}.png`,
      imageId,
      cachedExtents,
      setShowCredsExpiredAlert
    );
  }

  logger.info("No cached tiles found for:", fileName, "- generating tiles...");

  try {
    return await new Promise<ImageryLayer | undefined>((resolve, reject) => {
      exec("docker pull tumgis/ctb-quantized-mesh:alpine", async (err) => {
        if (err) {
          reject(new Error(`Failed to pull Docker image: ${err.message}`));
          return;
        }

        const jobName = "ctb-tile-creation-" + uuid.v4();
        exec(
          `docker run -d --name ${jobName} -v ${imageFolder}:/data/images/ -v ${tileFolder}:/data/tiles/ -v ${path.resolve(process.cwd(), "scripts")}:/data/scripts/ tumgis/ctb-quantized-mesh:alpine tail -f /dev/null`,
          async (err) => {
            if (err) {
              reject(new Error(`Failed to run Docker container: ${err.message}`));
              return;
            }

            // Step 1: Warp image to EPSG:4326 to handle projected CRS and rotation.
            // This ensures ctb-tile receives a geographic, axis-aligned raster.
            logger.info("Warping image to EPSG:4326...");
            exec(
              `docker exec ${jobName} sh -c "gdalwarp -t_srs EPSG:4326 -r bilinear -dstalpha -co TILED=YES -overwrite /data/images/${fileName} /data/images/${warpedFileName}"`,
              async (err) => {
                if (err) {
                  stopAndRemoveContainer(jobName);
                  reject(new Error(`Failed to warp image to EPSG:4326: ${err.message}`));
                  return;
                }
                logger.info("Successfully warped image to EPSG:4326");

                // Step 2: Calculate extents from the warped image
                exec(
                  `docker exec ${jobName} sh -c "apk add --no-cache python3 >/dev/null 2>&1 && chmod -R 755 /data/images/ && chmod -R 755 /data/scripts/ && python3 /data/scripts/calculate_extents.py /data/images/${warpedFileName}"`,
                  async (err, extentsOutput) => {
                    if (err) {
                      cleanupWarpedFile(warpedFilePath);
                      stopAndRemoveContainer(jobName);
                      reject(new Error(`Failed to calculate extents: ${err.message}`));
                      return;
                    }

                    try {
                      const extents = JSON.parse(extentsOutput.trim());
                      logger.info("Successfully calculated extents:", extents);

                      // Step 3: Generate tiles into a per-image subdirectory
                      exec(
                        `docker exec ${jobName} sh -c "mkdir -p /data/tiles/${baseName} && chmod -R 755 /data/tiles/ && ctb-tile -f PNG -R -C -N -s ${ZOOM_MAX} -e ${ZOOM_MIN} -t 256 -o /data/tiles/${baseName} /data/images/${warpedFileName}"`,
                        async (err) => {
                          if (err) {
                            cleanupWarpedFile(warpedFilePath);
                            stopAndRemoveContainer(jobName);
                            reject(new Error(`Failed to create tiles: ${err.message}`));
                            return;
                          }

                          try {
                            // Persist extents so subsequent loads skip the Docker pipeline
                            saveCachedExtents(tileCacheDir, extents);

                            const tileBaseUrl = typeof window !== "undefined"
                              ? window.location.origin
                              : FALLBACK_DEV_URL;
                            const layer = await addImageLayerWithExtents(
                              cesium.viewer,
                              `${tileBaseUrl}/src/data/tiles/imagery/${baseName}/{z}/{x}/{reverseY}.png`,
                              imageId,
                              extents,
                              setShowCredsExpiredAlert
                            );
                            resolve(layer);
                          } catch (error) {
                            reject(error);
                          } finally {
                            cleanupWarpedFile(warpedFilePath);
                            stopAndRemoveContainer(jobName);
                          }
                        }
                      );
                    } catch (parseError: unknown) {
                      cleanupWarpedFile(warpedFilePath);
                      stopAndRemoveContainer(jobName);
                      reject(new Error(`Failed to parse extents output: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
                    }
                  }
                );
              }
            );
          }
        );
      });
    });
  } catch (error) {
    logger.error("Error converting image to Cesium:", error);
    throw error;
  }
}

/**
 * Loads an image from S3 into Cesium, downloading it first if not cached locally.
 *
 * @param cesium - Cesium viewer wrapper.
 * @param bucket - S3 bucket name.
 * @param s3Object - S3 object key for the image.
 * @param imageId - Unique identifier for the image.
 * @param setShowCredsExpiredAlert - Callback to surface credential expiry to the UI.
 * @returns The added imagery layer, or undefined if credentials expired.
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
          logger.info("Downloading image from S3...");

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
            logger.info(`Successfully downloaded image to: ${outFilePath}`);
            resolve();
          });
        } else {
          logger.debug(`${outFilePath} already exists`);
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
    logger.error("Error loading image in Cesium:", error);
    throw error;
  }
}
