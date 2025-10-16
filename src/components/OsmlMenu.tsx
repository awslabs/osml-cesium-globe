// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import { ButtonDropdown } from "@cloudscape-design/components";
import Icon from "@cloudscape-design/components/icon";
import { useContext, useState } from "react";
import { CesiumContext } from "resium";

import ImageRequestModal from "@/components/modal/ImageRequestModal";
import { unloadAllGeoJsonFeatures } from "@/util/cesiumHelper";

import CredsExpiredAlert from "./alert/CredsExpiredAlert";
import LoadDataModal from "./modal/LoadDataModal";
import LoadImageModal from "./modal/LoadImageModal";

const OsmlMenu = ({
  imageRequestStatus,
  setImageRequestStatus
}: {
  imageRequestStatus: any;
  setImageRequestStatus: any;
}) => {
  const cesium = useContext(CesiumContext);
  // Set initial state
  const [showImageRequestModal, setShowImageRequestModal] = useState(false);
  const [showLoadDataModal, setShowLoadDataModal] = useState(false);
  const [showLoadImageModal, setShowLoadImageModal] = useState(false);
  const [showCredsExpiredAlert, setShowCredsExpiredAlert] = useState(false);

  return (
    <>
      <ButtonDropdown
        items={[
          { text: "Submit Image Request", id: "new_request" },
          {
            id: "load",
            text: "Load",
            items: [
              { id: "load_geojson", text: "GeoJSON" },
              { id: "load_image", text: "Image" }
            ]
          },
          { text: "Clear All Features", id: "clear_features" }
        ]}
        onItemClick={(e) => {
          if (e.detail.id === "load_geojson") {
            setShowLoadDataModal(true);
          } else if (e.detail.id === "load_image") {
            setShowLoadImageModal(true);
          } else if (e.detail.id === "new_request") {
            setShowImageRequestModal(true);
          } else if (e.detail.id === "clear_features" && cesium.viewer) {
            void unloadAllGeoJsonFeatures(cesium.viewer);
          }
        }}
        variant="primary"
      >
        <Icon name="menu" />
      </ButtonDropdown>

      {showCredsExpiredAlert && (
        <CredsExpiredAlert
          setShowCredsExpiredAlert={setShowCredsExpiredAlert}
        />
      )}

      <LoadDataModal
        showLoadDataModal={showLoadDataModal}
        setShowLoadDataModal={setShowLoadDataModal}
        showCredsExpiredAlert={showCredsExpiredAlert}
        setShowCredsExpiredAlert={setShowCredsExpiredAlert}
      />
      <LoadImageModal
        showLoadImageModal={showLoadImageModal}
        setShowLoadImageModal={setShowLoadImageModal}
        showCredsExpiredAlert={showCredsExpiredAlert}
        setShowCredsExpiredAlert={setShowCredsExpiredAlert}
      />
      <ImageRequestModal
        showImageRequestModal={showImageRequestModal}
        setShowImageRequestModal={setShowImageRequestModal}
        imageRequestStatus={imageRequestStatus}
        setImageRequestStatus={setImageRequestStatus}
        showCredsExpiredAlert={showCredsExpiredAlert}
        setShowCredsExpiredAlert={setShowCredsExpiredAlert}
      />
    </>
  );
};

export default OsmlMenu;
