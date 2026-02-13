// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import * as Cesium from "cesium";
import { GeoJsonDataSource, ImageryLayer, Viewer } from "cesium";
import React, { createContext, useCallback, useContext, useState } from "react";

import { CAMERA_FLY_DURATION_SECONDS } from "@/config";
import { logger } from "@/utils/logger";

export interface FeatureCollectionResource {
  id: string;
  name: string;
  type: "feature-collection";
  source: "local" | "s3";
  sourceDetail: string;
  featureCount: number;
  color: string;
  visible: boolean;
  loadedAt: Date;
  dataSource: GeoJsonDataSource;
}

export interface ImageryResource {
  id: string;
  name: string;
  type: "imagery";
  source: "local" | "s3";
  sourceDetail: string;
  visible: boolean;
  loadedAt: Date;
  imageryLayer: ImageryLayer;
}

export type LoadedResource = FeatureCollectionResource | ImageryResource;

interface ResourceContextValue {
  resources: LoadedResource[];
  addResource: (resource: LoadedResource) => void;
  removeResource: (id: string, viewer: Viewer) => void;
  toggleVisibility: (id: string, viewer: Viewer) => void;
  zoomTo: (id: string, viewer: Viewer) => void;
  clearAll: (viewer: Viewer) => void;
}

const ResourceContext = createContext<ResourceContextValue | undefined>(undefined);

export const ResourceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [resources, setResources] = useState<LoadedResource[]>([]);

  const addResource = useCallback((resource: LoadedResource) => {
    setResources((prev) => [...prev, resource]);
  }, []);

  const removeResource = useCallback((id: string, viewer: Viewer) => {
    setResources((prev) => {
      const resource = prev.find((r) => r.id === id);
      if (!resource) return prev;

      try {
        if (resource.type === "feature-collection") {
          const fc = resource as FeatureCollectionResource;
          if (viewer.dataSources.contains(fc.dataSource)) {
            viewer.dataSources.remove(fc.dataSource, true);
          }
        } else if (resource.type === "imagery") {
          const img = resource as ImageryResource;
          if (viewer.scene.imageryLayers.contains(img.imageryLayer)) {
            viewer.scene.imageryLayers.remove(img.imageryLayer, true);
          }
        }
      } catch (error) {
        logger.error("Error removing resource:", error);
      }

      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const toggleVisibility = useCallback((id: string, viewer: Viewer) => {
    setResources((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const newVisible = !r.visible;

        try {
          if (r.type === "feature-collection") {
            const fc = r as FeatureCollectionResource;
            fc.dataSource.show = newVisible;
          } else if (r.type === "imagery") {
            const img = r as ImageryResource;
            img.imageryLayer.show = newVisible;
          }
        } catch (error) {
          logger.error("Error toggling visibility:", error);
        }

        return { ...r, visible: newVisible };
      })
    );
  }, []);

  const zoomTo = useCallback((id: string, viewer: Viewer) => {
    // Use the state setter pattern to avoid stale closure over resources
    setResources((prev) => {
      const resource = prev.find((r) => r.id === id);
      if (!resource) return prev;

      try {
        if (resource.type === "feature-collection") {
          const fc = resource as FeatureCollectionResource;
          viewer.zoomTo(fc.dataSource);
        } else if (resource.type === "imagery") {
          const img = resource as ImageryResource;
          const rectangle = img.imageryLayer.imageryProvider.rectangle;
          if (rectangle) {
            viewer.camera.flyTo({
              destination: rectangle,
              duration: CAMERA_FLY_DURATION_SECONDS
            });
          }
        }
      } catch (error) {
        logger.error("Error zooming to resource:", error);
      }

      return prev; // Don't modify state, just read it
    });
  }, []);

  const clearAll = useCallback((viewer: Viewer) => {
    setResources((prev) => {
      for (const resource of prev) {
        try {
          if (resource.type === "feature-collection") {
            const fc = resource as FeatureCollectionResource;
            if (viewer.dataSources.contains(fc.dataSource)) {
              viewer.dataSources.remove(fc.dataSource, true);
            }
          } else if (resource.type === "imagery") {
            const img = resource as ImageryResource;
            if (viewer.scene.imageryLayers.contains(img.imageryLayer)) {
              viewer.scene.imageryLayers.remove(img.imageryLayer, true);
            }
          }
        } catch (error) {
          logger.error("Error clearing resource:", error);
        }
      }

      // Also clear any billboards
      const entities = viewer.entities.values;
      for (let i = entities.length - 1; i >= 0; i--) {
        if (entities[i].billboard) {
          viewer.entities.remove(entities[i]);
        }
      }

      return [];
    });
  }, []);

  return (
    <ResourceContext.Provider
      value={{ resources, addResource, removeResource, toggleVisibility, zoomTo, clearAll }}
    >
      {children}
    </ResourceContext.Provider>
  );
};

export const useResources = (): ResourceContextValue => {
  const context = useContext(ResourceContext);
  if (!context) {
    throw new Error("useResources must be used within a ResourceProvider");
  }
  return context;
};
