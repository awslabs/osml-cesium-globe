// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import { Alert } from "@cloudscape-design/components";

interface ImageRequestStatusProps {
  imageRequestStatus: {
    state: string;
    data: Record<string, any>;
  };
  setImageRequestStatus: (status: { state: string; data: Record<string, any> }) => void;
}

const statusMessages = {
  loading: {
    type: "info" as const,
    title: "Submitting Request",
    message: "Your image processing request is being submitted. Please wait..."
  },
  pending: {
    type: "info" as const,
    title: "Request Pending",
    message: "Your request is in the queue and will be processed shortly."
  },
  "in-progress": {
    type: "info" as const,
    title: "Processing",
    message: "Your image is being processed. This may take a few minutes..."
  },
  success: {
    type: "success" as const,
    title: "Success",
    message: (data: Record<string, any>) =>
      `Your image has been successfully processed and detected ${data.featureCount || 0} features in ${data.processingDuration || 0} seconds.`
  },
  error: {
    type: "error" as const,
    title: "Error",
    message: "There was an error processing your request. Please try again."
  },
  warning: {
    type: "warning" as const,
    title: "Partial Success",
    message: "Some features were processed successfully, but there were some issues."
  }
};

const ImageRequestStatus = ({
  imageRequestStatus,
  setImageRequestStatus
}: ImageRequestStatusProps) => {
  const status = statusMessages[imageRequestStatus.state as keyof typeof statusMessages];

  if (!status) {
    return null;
  }

  const message = typeof status.message === 'function'
    ? status.message(imageRequestStatus.data)
    : status.message;

  return (
    <Alert
      type={status.type}
      header={status.title}
      dismissible
      onDismiss={() => {
        if (imageRequestStatus.state === "success" || imageRequestStatus.state === "error") {
          setImageRequestStatus({ state: "idle", data: {} });
        }
      }}
    >
      {message}
    </Alert>
  );
};

export default ImageRequestStatus;
