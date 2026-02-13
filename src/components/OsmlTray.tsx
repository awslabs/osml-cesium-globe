// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Top-level tray container that positions the OSML menu panel.
 */

import React from "react";

import OsmlMenu from "@/components/OsmlMenu";
import type { FeaturePopupData } from "@/components/FeaturePopup";
import type { ImageRequestState } from "@/types";

interface OsmlTrayProps {
  imageRequestStatus: ImageRequestState;
  setImageRequestStatus: React.Dispatch<React.SetStateAction<ImageRequestState>>;
  onFeatureClick?: (data: FeaturePopupData | null) => void;
}

const OsmlTray = ({ imageRequestStatus, setImageRequestStatus, onFeatureClick }: OsmlTrayProps) => {
  return (
    <div className="osml-tray">
      <OsmlMenu
        imageRequestStatus={imageRequestStatus}
        setImageRequestStatus={setImageRequestStatus}
        onFeatureClick={onFeatureClick}
      />
    </div>
  );
};

export default OsmlTray;
