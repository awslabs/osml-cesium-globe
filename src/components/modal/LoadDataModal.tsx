// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import fs from "fs";
import { useContext, useState } from "react";
import { CesiumContext } from "resium";
import * as uuid from "uuid";

import { DEFAULT_RESULTS_COLOR_OPTION, LOCAL_GEOJSON_FOLDER } from "@/config";
import { useResources } from "@/context/ResourceContext";
import { useS3Browser } from "@/hooks/useS3Browser";
import { loadGeoJson, loadS3GeoJson, type FeaturePopupCallback } from "@/utils/cesiumHelper";
import { logger } from "@/utils/logger";

import {
  DarkAutosuggest,
  DarkFormField
} from "../ui/FormControls";
import DarkModal from "./DarkModal";

const LoadDataModal = ({
  showLoadDataModal,
  setShowLoadDataModal,
  showCredsExpiredAlert,
  setShowCredsExpiredAlert,
  onFeatureClick
}: {
  showLoadDataModal: boolean;
  setShowLoadDataModal: (show: boolean) => void;
  showCredsExpiredAlert: boolean;
  setShowCredsExpiredAlert: (show: boolean) => void;
  onFeatureClick?: FeaturePopupCallback;
}) => {
  const cesium = useContext(CesiumContext);
  const { addResource } = useResources();

  const [activeTab, setActiveTab] = useState<"s3" | "local">("s3");
  const [localFile, setLocalFile] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Object, setS3Object] = useState("");

  // S3 bucket/object browsing via shared hook
  const {
    buckets: s3Buckets,
    bucketStatus,
    objects: s3Objects,
    objectStatus: geojsonStatus,
    loadObjects: loadS3Objects,
    resetObjects
  } = useS3Browser({
    enabled: showLoadDataModal,
    setShowCredsExpiredAlert,
    objectFilter: (key) => key.endsWith(".geojson") || key.endsWith(".json")
  });

  // Local file list
  const fileList = fs
    .readdirSync(LOCAL_GEOJSON_FOLDER)
    .filter((file) => {
      const stat = fs.lstatSync(LOCAL_GEOJSON_FOLDER + file);
      return stat.isFile() && (file.endsWith(".geojson") || file.endsWith(".json"));
    });
  const localFileList = fileList.map((file) => ({ value: file }));

  const handleDismiss = () => {
    setShowLoadDataModal(false);
    setS3Bucket("");
    setS3Object("");
    setLocalFile("");
  };

  const displayData = () => {
    if (activeTab === "s3") {
      if (s3Bucket && s3Object && cesium?.viewer) {
        const objectName = s3Object.split("/").pop() || s3Object;
        void loadS3GeoJson(
          { viewer: cesium.viewer as any },
          s3Bucket,
          s3Object,
          DEFAULT_RESULTS_COLOR_OPTION.value,
          setShowCredsExpiredAlert,
          onFeatureClick
        ).then((result) => {
          logger.info(`Successfully loaded ${s3Object}`);
          addResource({
            id: uuid.v4(),
            name: objectName.replace(/\.(geojson|json)$/i, ""),
            type: "feature-collection",
            source: "s3",
            sourceDetail: `${s3Bucket}/${s3Object}`,
            featureCount: result.featureCount,
            color: DEFAULT_RESULTS_COLOR_OPTION.value,
            visible: true,
            loadedAt: new Date(),
            dataSource: result.dataSource
          });
        });
        handleDismiss();
      }
    } else if (activeTab === "local") {
      if (localFile && cesium?.viewer) {
        const features = fs.readFileSync(LOCAL_GEOJSON_FOLDER + localFile, "utf8");
        const jobId = localFile.split(".")[0];
        loadGeoJson(
          cesium.viewer,
          features,
          jobId,
          DEFAULT_RESULTS_COLOR_OPTION.value,
          onFeatureClick
        ).then((result) => {
          logger.info(`Successfully loaded ${localFile}`);
          addResource({
            id: uuid.v4(),
            name: jobId,
            type: "feature-collection",
            source: "local",
            sourceDetail: localFile,
            featureCount: result.featureCount,
            color: DEFAULT_RESULTS_COLOR_OPTION.value,
            visible: true,
            loadedAt: new Date(),
            dataSource: result.dataSource
          });
        });
        handleDismiss();
      }
    }
  };

  const canSubmit =
    (activeTab === "s3" && s3Bucket && s3Object) ||
    (activeTab === "local" && localFile);

  return (
    <DarkModal
      visible={showLoadDataModal}
      onDismiss={handleDismiss}
      title="Load GeoJSON"
      subtitle="Import feature collections from S3 or local storage"
      size="md"
      icon={
        <div style={{ background: "rgba(52, 211, 153, 0.15)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 3h8l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="rgb(52, 211, 153)" strokeWidth="1.5" />
            <path d="M12 3v4h4" stroke="rgb(52, 211, 153)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7 12l2 2 4-4" stroke="rgb(52, 211, 153)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      }
      footer={
        <>
          <button className="dm-btn dm-btn--ghost" onClick={handleDismiss}>Cancel</button>
          <button className="dm-btn dm-btn--primary" onClick={displayData} disabled={!canSubmit}>
            Load Data
          </button>
        </>
      }
    >
      <div className="dm-tabs">
        <button className={`dm-tab ${activeTab === "s3" ? "dm-tab--active" : ""}`} onClick={() => setActiveTab("s3")}>From S3</button>
        <button className={`dm-tab ${activeTab === "local" ? "dm-tab--active" : ""}`} onClick={() => setActiveTab("local")}>From Local</button>
      </div>

      {activeTab === "s3" && (
        <>
          <div className="dm-field">
            <DarkFormField label="Bucket" description="S3 bucket containing GeoJSON files.">
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
            <DarkFormField label="GeoJSON File" description="S3 object key for the GeoJSON file.">
              <DarkAutosuggest
                value={s3Object}
                onChange={setS3Object}
                options={s3Objects}
                placeholder="Select a GeoJSON file"
                status={geojsonStatus}
                loadingText="Loading files..."
                errorText="Could not load files"
                empty="No GeoJSON files found"
              />
            </DarkFormField>
          </div>
        </>
      )}

      {activeTab === "local" && (
        <div className="dm-field">
          <DarkFormField label="Local File" description="Select a GeoJSON file from the local data directory.">
            <DarkAutosuggest
              value={localFile}
              onChange={setLocalFile}
              options={localFileList}
              placeholder="Select a local file"
              empty="No GeoJSON files found"
            />
          </DarkFormField>
        </div>
      )}
    </DarkModal>
  );
};

export default LoadDataModal;
