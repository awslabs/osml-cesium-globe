// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { useState } from "react";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { getAWSCreds, isCredentialError, REGION } from "@/config";
import "./ConfigWarnings.css";

const CredsExpiredAlert = ({
  setShowCredsExpiredAlert
}: {
  setShowCredsExpiredAlert: (value: boolean) => void;
}) => {
  const [message, setMessage] = useState(
    "Refresh your credentials before closing this alert."
  );
  const [retrying, setRetrying] = useState(false);
  const [exiting, setExiting] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await new STSClient({
        region: REGION,
        credentials: getAWSCreds()
      }).send(new GetCallerIdentityCommand({}));

      // Success — dismiss
      setExiting(true);
      setTimeout(() => setShowCredsExpiredAlert(false), 300);
    } catch (e: unknown) {
      if (isCredentialError(e)) {
        setMessage(
          "AWS credentials are still invalid. Refresh your credentials and try again."
        );
      } else {
        setMessage(
          "An unexpected error occurred while verifying credentials. Please restart the application."
        );
      }
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="cw-stack">
      <div
        className={`cw-toast ${exiting ? "cw-toast--exit" : ""}`}
        style={{
          background: "rgba(220, 38, 38, 0.12)",
          borderColor: "rgba(220, 38, 38, 0.3)"
        }}
      >
        {/* Error icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ flexShrink: 0 }}
        >
          <circle cx="10" cy="10" r="8.5" stroke="#f87171" strokeWidth="1.5" />
          <path
            d="M10 6v5"
            stroke="#f87171"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="14" r="0.8" fill="#f87171" />
        </svg>

        <div className="cw-toast-body">
          <div className="cw-toast-title" style={{ color: "#fca5a5" }}>
            Credentials Expired
          </div>
          <div className="cw-toast-message" style={{ color: "#fca5a5" }}>
            {message}
          </div>
        </div>

        <button
          className="cw-toast-action"
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? "Checking..." : "Retry"}
        </button>

        <button
          className="cw-toast-close"
          onClick={() => {
            setExiting(true);
            setTimeout(() => setShowCredsExpiredAlert(false), 300);
          }}
          style={{ color: "#fca5a5" }}
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CredsExpiredAlert;
