// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import {
  Box,
  Button,
  Modal,
  SpaceBetween,
  Tabs
} from "@cloudscape-design/components";
import fs from "fs";
import { useContext, useState } from "react";
import { CesiumContext } from "resium";

import LocalDataSelector from "@/components/LocalDataSelector";
import S3DataSelector from "@/components/S3DataSelector";
import { DEFAULT_RESULTS_COLOR_OPTION, LOCAL_GEOJSON_FOLDER } from "@/config";
import { loadGeoJson, loadS3GeoJson } from "@/util/cesiumHelper";

import CredsExpiredAlert from "../alert/CredsExpiredAlert";

const LoadDataModal = ({
  showLoadDataModal,
  setShowLoadDataModal,
  showCredsExpiredAlert,
  setShowCredsExpiredAlert
}: {
  showLoadDataModal: any;
  setShowLoadDataModal: any;
  showCredsExpiredAlert: any;
  setShowCredsExpiredAlert: any;
}) => {
  const cesium = useContext(CesiumContext);
  const [localFile, setLocalFile] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Object, setS3Object] = useState("");
  const [activeTabId, setActiveTabId] = useState("S3");

  const displayData = () => {
    if (activeTabId == "S3") {
      if (s3Bucket && s3Object && cesium?.viewer) {
        void loadS3GeoJson(
          { viewer: cesium.viewer as any },
          s3Bucket,
          s3Object,
          DEFAULT_RESULTS_COLOR_OPTION.value,
          setShowCredsExpiredAlert
        ).then(() => console.log(`Successfully loaded ${s3Object}!`));
        setShowLoadDataModal(false);
      }
    } else if (activeTabId == "local") {
      if (localFile && cesium.viewer) {
        const features = fs.readFileSync(
          LOCAL_GEOJSON_FOLDER + localFile,
          "utf8"
        );
        loadGeoJson(
          cesium.viewer,
          features,
          localFile.split(".")[0],
          DEFAULT_RESULTS_COLOR_OPTION.value
        ).then((r) => console.log(`Successfully loaded ${localFile}!`));
        setShowLoadDataModal(false);
      }
    }
  };

  return (
    <Modal
      onDismiss={() => setShowLoadDataModal(false)}
      visible={showLoadDataModal}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setShowLoadDataModal(false)} variant="link">
              Cancel
            </Button>
            <Button
              onClick={() => {
                displayData();
              }}
              variant="primary"
            >
              Load Data
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Load GeoJson Data"
    >
      {showCredsExpiredAlert && (
        <CredsExpiredAlert
          setShowCredsExpiredAlert={setShowCredsExpiredAlert}
        />
      )}

      <Tabs
        onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
        activeTabId={activeTabId}
        tabs={[
          {
            label: "From S3",
            id: "S3",
            content: (
              <S3DataSelector
                s3Object={s3Object}
                setS3Object={setS3Object}
                s3Bucket={s3Bucket}
                setS3Bucket={setS3Bucket}
                setShowCredsExpiredAlert={setShowCredsExpiredAlert}
                showCredsExpiredAlert={showCredsExpiredAlert}
              />
            )
          },
          {
            label: "From Local",
            id: "local",
            content: (
              <LocalDataSelector
                localFile={localFile}
                setLocalFile={setLocalFile}
              />
            )
          }
        ]}
      />
    </Modal>
  );
};

export default LoadDataModal;
