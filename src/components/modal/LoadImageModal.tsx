// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Modal for importing imagery from local files or S3 buckets into the globe.
 */

import fs from "fs";
import { useContext, useState } from "react";
import { CesiumContext } from "resium";
import * as uuid from "uuid";

import { LOCAL_IMAGE_DATA_FOLDER } from "@/config";
import { useResources } from "@/context/ResourceContext";
import { useS3Browser } from "@/hooks/useS3Browser";
import { convertImageToCesium, loadImageInCesium } from "@/utils/cesiumHelper";
import { logger } from "@/utils/logger";

import {
  DarkAutosuggest,
  DarkFormField
} from "../ui/FormControls";
import DarkModal from "./DarkModal";

function isImageFile(filename: string): boolean {
  const imageExtensions = [".tif", ".tiff", ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".ntf"];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  return imageExtensions.includes(ext);
}

const LoadImageModal = ({
  showLoadImageModal,
  setShowLoadImageModal,
  showCredsExpiredAlert,
  setShowCredsExpiredAlert
}: {
  showLoadImageModal: boolean;
  setShowLoadImageModal: (show: boolean) => void;
  showCredsExpiredAlert: boolean;
  setShowCredsExpiredAlert: (show: boolean) => void;
}) => {
  const cesium = useContext(CesiumContext);
  const { addResource } = useResources();

  const [activeTab, setActiveTab] = useState<"local" | "s3">("local");
  const [localFile, setLocalFile] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Object, setS3Object] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // S3 bucket/object browsing via shared hook
  const {
    buckets: s3Buckets,
    bucketStatus,
    objects: s3Objects,
    objectStatus: imageStatus,
    loadObjects: loadS3Objects,
    resetObjects
  } = useS3Browser({
    enabled: showLoadImageModal,
    setShowCredsExpiredAlert,
    objectFilter: (key) => isImageFile(key)
  });

  // Local file list
  const fileList = fs
    .readdirSync(LOCAL_IMAGE_DATA_FOLDER)
    .filter((file) => {
      const stat = fs.lstatSync(LOCAL_IMAGE_DATA_FOLDER + file);
      return stat.isFile() && isImageFile(file);
    });
  const localFileList = fileList.map((file) => ({ value: file }));

  const handleDismiss = () => {
    if (!isLoading) {
      setShowLoadImageModal(false);
      setLocalFile("");
      setS3Bucket("");
      setS3Object("");
    }
  };

  const loadImage = () => {
    if (isLoading) return;

    if (activeTab === "local" && localFile && cesium?.viewer) {
      setIsLoading(true);
      const imageId = localFile.split(".")[0];
      void convertImageToCesium(
        { viewer: cesium.viewer as any },
        localFile,
        imageId,
        setShowCredsExpiredAlert
      )
        .then((imageryLayer) => {
          logger.info(`Successfully loaded local image: ${localFile}`);
          if (imageryLayer) {
            addResource({
              id: uuid.v4(),
              name: imageId,
              type: "imagery",
              source: "local",
              sourceDetail: localFile,
              visible: true,
              loadedAt: new Date(),
              imageryLayer: imageryLayer
            });
          }
          setShowLoadImageModal(false);
          setLocalFile("");
          setIsLoading(false);
        })
        .catch((error) => {
          logger.error("Error loading local image:", error);
          setIsLoading(false);
        });
    } else if (activeTab === "s3" && s3Bucket && s3Object && cesium?.viewer) {
      setIsLoading(true);
      const imageId = s3Object.split("/").pop()?.split(".")[0] || "s3-image";
      void loadImageInCesium(
        { viewer: cesium.viewer as any },
        s3Bucket,
        s3Object,
        imageId,
        setShowCredsExpiredAlert
      )
        .then((imageryLayer) => {
          logger.info(`Successfully loaded S3 image: ${s3Object}`);
          if (imageryLayer) {
            addResource({
              id: uuid.v4(),
              name: imageId,
              type: "imagery",
              source: "s3",
              sourceDetail: `${s3Bucket}/${s3Object}`,
              visible: true,
              loadedAt: new Date(),
              imageryLayer: imageryLayer
            });
          }
          setShowLoadImageModal(false);
          setS3Bucket("");
          setS3Object("");
          setIsLoading(false);
        })
        .catch((error) => {
          logger.error("Error loading S3 image:", error);
          setIsLoading(false);
        });
    }
  };

  const canSubmit =
    !isLoading &&
    ((activeTab === "local" && !!localFile) ||
      (activeTab === "s3" && !!s3Bucket && !!s3Object));

  return (
    <DarkModal
      visible={showLoadImageModal}
      onDismiss={handleDismiss}
      title="Load Image"
      subtitle="Import imagery from local files or S3 buckets"
      size="md"
      icon={
        <div style={{ background: "rgba(96, 165, 250, 0.15)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="3" width="16" height="14" rx="2" stroke="rgb(96, 165, 250)" strokeWidth="1.5" />
            <path d="M2 14l5-5 3 3 3-4 5 6" stroke="rgb(96, 165, 250)" strokeWidth="1.3" strokeLinejoin="round" />
            <circle cx="13" cy="7.5" r="1.5" fill="rgb(96, 165, 250)" fillOpacity="0.5" />
          </svg>
        </div>
      }
      footer={
        <>
          <button className="dm-btn dm-btn--ghost" onClick={handleDismiss} disabled={isLoading}>Cancel</button>
          <button className="dm-btn dm-btn--primary" onClick={loadImage} disabled={!canSubmit}>
            {isLoading ? (<><span className="dm-spinner" /> Loading...</>) : "Load Image"}
          </button>
        </>
      }
    >
      <div className="dm-tabs">
        <button className={`dm-tab ${activeTab === "local" ? "dm-tab--active" : ""}`} onClick={() => setActiveTab("local")}>From Local</button>
        <button className={`dm-tab ${activeTab === "s3" ? "dm-tab--active" : ""}`} onClick={() => setActiveTab("s3")}>From S3</button>
      </div>

      {activeTab === "local" && (
        <>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "0 0 14px", lineHeight: 1.5 }}>
            Select an image file from the local images directory to load into the globe.
          </p>
          <div className="dm-field">
            <DarkFormField label="Image File">
              <DarkAutosuggest
                value={localFile}
                onChange={setLocalFile}
                options={localFileList}
                placeholder="Select an image file"
                empty="No image files found"
              />
            </DarkFormField>
          </div>
        </>
      )}

      {activeTab === "s3" && (
        <>
          <div className="dm-field">
            <DarkFormField label="Bucket" description="S3 bucket containing image files.">
              <DarkAutosuggest
                value={s3Bucket}
                onChange={(val) => {
                  setS3Bucket(val);
                  resetObjects();
                  if (val) loadS3Objects(val);
                }}
                options={s3Buckets}
                placeholder="Select or type a bucket name"
                status={bucketStatus}
                loadingText="Loading buckets..."
                errorText="Could not load buckets"
                empty="No buckets found"
              />
            </DarkFormField>
          </div>
          <div className="dm-field">
            <DarkFormField label="Image" description="S3 object key for the image file.">
              <DarkAutosuggest
                value={s3Object}
                onChange={setS3Object}
                options={s3Objects}
                placeholder="Select an image file"
                status={imageStatus}
                loadingText="Loading images..."
                errorText="Could not load images"
                empty="No image files found"
              />
            </DarkFormField>
          </div>
        </>
      )}
    </DarkModal>
  );
};

export default LoadImageModal;
