// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React from "react";

import OsmlMenu from "@/components/OsmlMenu";
import type { FeaturePopupData } from "@/components/FeaturePopup";

interface OsmlTrayProps {
  imageRequestStatus: {
    state: string;
    data: Record<string, any>;
  };
  setImageRequestStatus: (status: { state: string; data: Record<string, any> }) => void;
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
