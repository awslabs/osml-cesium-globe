// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import React from "react";
import { Container } from "@cloudscape-design/components";

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
      <Container>
        <ImageRequestStatus
          imageRequestStatus={imageRequestStatus}
          setImageRequestStatus={setImageRequestStatus}
        />
      </Container>
    </div>
  );
};

export default StatusDisplay;
