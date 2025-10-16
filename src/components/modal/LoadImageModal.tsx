// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import { Autosuggest } from "@cloudscape-design/components";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Tabs from "@cloudscape-design/components/tabs";
import { useContext, useState } from "react";
import { CesiumContext } from "resium";
import fs from "fs";

import { LOCAL_IMAGE_DATA_FOLDER } from "@/config";
import { convertImageToCesium, loadImageInCesium } from "@/util/cesiumHelper";

import CredsExpiredAlert from "../alert/CredsExpiredAlert";
import S3ImageSelector from "../S3ImageSelector";

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
  const [localFile, setLocalFile] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Object, setS3Object] = useState("");
  const [activeTabId, setActiveTabId] = useState("local");
  const [isLoading, setIsLoading] = useState(false);

  // Get list of image files from the local images directory
  const fileList = fs
    .readdirSync(LOCAL_IMAGE_DATA_FOLDER)
    .filter((file) => {
      const stat = fs.lstatSync(LOCAL_IMAGE_DATA_FOLDER + file);
      return stat.isFile() && isImageFile(file);
    });

  const localFileList = fileList.map((file) => ({ value: file }));

  // Check if file is an image based on extension
  function isImageFile(filename: string): boolean {
    const imageExtensions = ['.tif', '.tiff', '.png', '.jpg', '.jpeg', '.bmp', '.gif', '.ntf'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  const loadImage = () => {
    if (isLoading) return; // Prevent multiple clicks

    if (activeTabId === "local" && localFile && cesium?.viewer) {
      setIsLoading(true);
      const imageId = localFile.split(".")[0];
      void convertImageToCesium(
        { viewer: cesium.viewer as any },
        localFile,
        imageId,
        setShowCredsExpiredAlert
      ).then(() => {
        console.log(`Successfully loaded local image: ${localFile}!`);
        setShowLoadImageModal(false);
        setLocalFile("");
        setIsLoading(false);
      }).catch((error) => {
        console.error("Error loading local image:", error);
        setIsLoading(false);
      });
    } else if (activeTabId === "s3" && s3Bucket && s3Object && cesium?.viewer) {
      setIsLoading(true);
      const imageId = s3Object.split("/").pop()?.split(".")[0] || "s3-image";
      void loadImageInCesium(
        { viewer: cesium.viewer as any },
        s3Bucket,
        s3Object,
        imageId,
        setShowCredsExpiredAlert
      ).then(() => {
        console.log(`Successfully loaded S3 image: ${s3Object}!`);
        setShowLoadImageModal(false);
        setS3Bucket("");
        setS3Object("");
        setIsLoading(false);
      }).catch((error) => {
        console.error("Error loading S3 image:", error);
        setIsLoading(false);
      });
    }
  };

  return (
    <Modal
      onDismiss={() => {
        if (!isLoading) {
          setShowLoadImageModal(false);
          setLocalFile("");
          setS3Bucket("");
          setS3Object("");
        }
      }}
      visible={showLoadImageModal}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              onClick={() => {
                if (!isLoading) {
                  setShowLoadImageModal(false);
                  setLocalFile("");
                  setS3Bucket("");
                  setS3Object("");
                }
              }}
              variant="link"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={loadImage}
              variant="primary"
              disabled={
                isLoading ||
                (activeTabId === "local" && !localFile) ||
                (activeTabId === "s3" && (!s3Bucket || !s3Object))
              }
            >
              {isLoading ? (
                <SpaceBetween direction="horizontal" size="xs">
                  <Spinner size="normal" />
                  <span>Loading...</span>
                </SpaceBetween>
              ) : (
                "Load Image"
              )}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Load Image"
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
            label: "From Local",
            id: "local",
            content: (
              <SpaceBetween direction="vertical" size="l">
                <Box variant="p">
                  Select an image file from the local images directory to load into Cesium.
                </Box>
                <Autosuggest
                  onChange={({ detail }) => {
                    if (detail.value) {
                      setLocalFile(detail.value);
                    }
                  }}
                  value={localFile}
                  options={localFileList}
                  enteredTextLabel={(value) => `Use: "${value}"`}
                  ariaLabel="Image File Selection"
                  placeholder="Select an image file"
                  empty="No image files found"
                />
              </SpaceBetween>
            )
          },
          {
            label: "From S3",
            id: "s3",
            content: (
              <S3ImageSelector
                s3Object={s3Object}
                setS3Object={setS3Object}
                s3Bucket={s3Bucket}
                setS3Bucket={setS3Bucket}
                setShowCredsExpiredAlert={setShowCredsExpiredAlert}
                showCredsExpiredAlert={showCredsExpiredAlert}
              />
            )
          }
        ]}
      />
    </Modal>
  );
};

export default LoadImageModal;
