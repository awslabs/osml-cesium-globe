// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React from "react";

import ImageRequestStatus from "@/components/ImageRequestStatus";

interface StatusDisplayProps {
  imageRequestStatus: {
    state: string;
    data: Record<string, any>;
  };
  setImageRequestStatus: (status: { state: string; data: Record<string, any> }) => void;
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
