// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React, { useEffect, useState } from "react";
import "./ImageRequestStatus.css";

interface ImageRequestStatusProps {
  imageRequestStatus: {
    state: string;
    data: Record<string, any>;
  };
  setImageRequestStatus: (status: { state: string; data: Record<string, any> }) => void;
}

type StatusType = "info" | "success" | "error" | "warning";

interface StatusConfig {
  type: StatusType;
  title: string;
  message: string | ((data: Record<string, any>) => string);
  accentColor: string;
  iconColor: string;
}

const statusMessages: Record<string, StatusConfig> = {
  loading: {
    type: "info",
    title: "Submitting Request",
    message: "Your image processing request is being submitted...",
    accentColor: "rgba(96, 165, 250, 0.3)",
    iconColor: "#60a5fa"
  },
  pending: {
    type: "info",
    title: "Request Pending",
    message: "Your request is queued and will be processed shortly.",
    accentColor: "rgba(96, 165, 250, 0.3)",
    iconColor: "#60a5fa"
  },
  "in-progress": {
    type: "info",
    title: "Processing",
    message: "Your image is being processed. This may take a few minutes...",
    accentColor: "rgba(251, 191, 36, 0.3)",
    iconColor: "#fbbf24"
  },
  success: {
    type: "success",
    title: "Success",
    message: (data: Record<string, any>) =>
      `Detected ${data.featureCount || 0} features in ${data.processingDuration || 0}s.`,
    accentColor: "rgba(52, 211, 153, 0.3)",
    iconColor: "#34d399"
  },
  error: {
    type: "error",
    title: "Error",
    message: "There was an error processing your request. Please try again.",
    accentColor: "rgba(248, 113, 113, 0.3)",
    iconColor: "#f87171"
  },
  warning: {
    type: "warning",
    title: "Partial Success",
    message: "Some features were processed, but there were some issues.",
    accentColor: "rgba(251, 191, 36, 0.3)",
    iconColor: "#fbbf24"
  }
};

const icons: Record<StatusType, React.ReactNode> = {
  info: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 8.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="12.5" r="0.7" fill="currentColor" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2L1.5 15.5h15L9 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 7v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="13" r="0.7" fill="currentColor" />
    </svg>
  )
};

const ImageRequestStatus = ({
  imageRequestStatus,
  setImageRequestStatus
}: ImageRequestStatusProps) => {
  const [visible, setVisible] = useState(false);
  const status = statusMessages[imageRequestStatus.state];

  // Animate in on mount
  useEffect(() => {
    if (status) {
      requestAnimationFrame(() => setVisible(true));
    }
    return () => setVisible(false);
  }, [imageRequestStatus.state]);

  if (!status) return null;

  const message =
    typeof status.message === "function"
      ? status.message(imageRequestStatus.data)
      : status.message;

  const canDismiss =
    imageRequestStatus.state === "success" || imageRequestStatus.state === "error";

  const isProcessing =
    imageRequestStatus.state === "loading" ||
    imageRequestStatus.state === "pending" ||
    imageRequestStatus.state === "in-progress";

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setImageRequestStatus({ state: "idle", data: {} }), 200);
  };

  return (
    <div
      className={`irs-card ${visible ? "irs-card--visible" : ""}`}
      style={{ borderColor: status.accentColor }}
    >
      {/* Icon */}
      <div className="irs-icon" style={{ color: status.iconColor }}>
        {isProcessing ? (
          <div className="irs-spinner" style={{ borderTopColor: status.iconColor }} />
        ) : (
          icons[status.type]
        )}
      </div>

      {/* Content */}
      <div className="irs-content">
        <div className="irs-title" style={{ color: status.iconColor }}>
          {status.title}
        </div>
        <div className="irs-message">{message}</div>
      </div>

      {/* Dismiss button */}
      {canDismiss && (
        <button className="irs-dismiss" onClick={handleDismiss} title="Dismiss">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ImageRequestStatus;
