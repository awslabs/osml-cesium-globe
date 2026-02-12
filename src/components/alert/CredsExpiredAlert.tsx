// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { useState } from "react";

import { getAWSCreds, REGION } from "@/config";

const startingAlertMessage =
  "Refresh your credentials before closing this alert.";

const CredsExpiredAlert = ({
  setShowCredsExpiredAlert
}: {
  setShowCredsExpiredAlert: any;
}) => {
  const [alertMessage, setAlertMessage] = useState(startingAlertMessage);

  const updateAlert = async () => {
    try {
      await new STSClient({
        region: REGION,
        credentials: getAWSCreds()
      }).send(new GetCallerIdentityCommand({}));
      setShowCredsExpiredAlert(false);
      setAlertMessage(startingAlertMessage);
    } catch (e: any) {
      console.error(`Exception caught: ${e}`);
      if (e.name === "ExpiredToken") {
        setAlertMessage(
          "AWS token still is expired. Refresh credentials and try again."
        );
      } else {
        setAlertMessage(
          "Unknown error occurred when testing credentials. Restart application."
        );
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 3000,
        background: "rgba(220, 38, 38, 0.15)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(220, 38, 38, 0.3)",
        borderRadius: 12,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        color: "#fca5a5",
        fontSize: 13,
        fontWeight: 500,
        maxWidth: 480,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        animation: "dm-panel-in 0.25s ease"
      }}
    >
      {/* Error icon */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="10" cy="10" r="8.5" stroke="#f87171" strokeWidth="1.5" />
        <path d="M10 6v5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="14" r="0.8" fill="#f87171" />
      </svg>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 650, marginBottom: 3, color: "#fca5a5" }}>
          Credentials Expired
        </div>
        <div style={{ color: "rgba(252, 165, 165, 0.7)", fontSize: 12, lineHeight: 1.4 }}>
          {alertMessage}
        </div>
      </div>

      <button
        onClick={() => updateAlert()}
        style={{
          background: "rgba(220, 38, 38, 0.2)",
          border: "1px solid rgba(220, 38, 38, 0.3)",
          borderRadius: 8,
          color: "#fca5a5",
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          whiteSpace: "nowrap"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "rgba(220, 38, 38, 0.35)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "rgba(220, 38, 38, 0.2)";
        }}
      >
        Retry
      </button>
    </div>
  );
};

export default CredsExpiredAlert;
