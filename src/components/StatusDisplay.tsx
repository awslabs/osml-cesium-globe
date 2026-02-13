// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React from "react";

import ImageRequestStatus from "@/components/ImageRequestStatus";
import type { ImageRequestState } from "@/types";

interface StatusDisplayProps {
  imageRequestStatus: ImageRequestState;
  setImageRequestStatus: (status: ImageRequestState) => void;
}

const StatusDisplay = ({ imageRequestStatus, setImageRequestStatus }: StatusDisplayProps) => {
  if (imageRequestStatus.state === "idle") {
    return null;
  }

  return (
    <div className="status-display">
      <ImageRequestStatus
        imageRequestStatus={imageRequestStatus}
        setImageRequestStatus={setImageRequestStatus}
      />
    </div>
  );
};

export default StatusDisplay;
