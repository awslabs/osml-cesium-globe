// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { useEffect, useState } from "react";
import { getConfigWarnings, type ConfigWarning } from "@/config";
import "./ConfigWarnings.css";

/** Auto-dismiss delay in ms per severity */
const DISMISS_DELAY: Record<ConfigWarning["severity"], number> = {
  warning: 12_000,
  error: 20_000
};

const SEVERITY_STYLES: Record<
  ConfigWarning["severity"],
  { accent: string; bg: string; border: string; icon: string }
> = {
  error: {
    accent: "#fca5a5",
    bg: "rgba(220, 38, 38, 0.12)",
    border: "rgba(220, 38, 38, 0.3)",
    icon: "#f87171"
  },
  warning: {
    accent: "#fcd34d",
    bg: "rgba(234, 179, 8, 0.10)",
    border: "rgba(234, 179, 8, 0.3)",
    icon: "#facc15"
  }
};

function WarningIcon({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M10 2L1 18h18L10 2z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 8v4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="15" r="0.8" fill={color} />
    </svg>
  );
}

function ErrorIcon({ color }: { color: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.5" />
      <path
        d="M10 6v5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14" r="0.8" fill={color} />
    </svg>
  );
}

function Toast({
  warning,
  onDismiss
}: {
  warning: ConfigWarning;
  onDismiss: () => void;
}) {
  const [exiting, setExiting] = useState(false);
  const s = SEVERITY_STYLES[warning.severity];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
    }, DISMISS_DELAY[warning.severity]);
    return () => clearTimeout(timer);
  }, [warning.severity]);

  // After the exit animation finishes, remove the toast
  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(onDismiss, 300);
    return () => clearTimeout(timer);
  }, [exiting, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
  };

  return (
    <div
      className={`cw-toast ${exiting ? "cw-toast--exit" : ""}`}
      style={{
        background: s.bg,
        borderColor: s.border
      }}
    >
      {warning.severity === "error" ? (
        <ErrorIcon color={s.icon} />
      ) : (
        <WarningIcon color={s.icon} />
      )}

      <div className="cw-toast-body">
        <div className="cw-toast-title" style={{ color: s.accent }}>
          {warning.title}
        </div>
        <div
          className="cw-toast-message"
          style={{ color: s.accent }}
        >
          {warning.message}
        </div>
      </div>

      <button
        className="cw-toast-close"
        onClick={handleDismiss}
        style={{ color: s.accent }}
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
  );
}

const ConfigWarnings = () => {
  const [warnings, setWarnings] = useState<ConfigWarning[]>([]);

  useEffect(() => {
    let cancelled = false;
    getConfigWarnings().then((result) => {
      if (!cancelled) setWarnings(result);
    });
    return () => { cancelled = true; };
  }, []);

  const dismiss = (index: number) => {
    setWarnings((prev) => prev.filter((_, i) => i !== index));
  };

  if (warnings.length === 0) return null;

  return (
    <div className="cw-stack">
      {warnings.map((w, i) => (
        <Toast key={`${w.severity}-${w.title}`} warning={w} onDismiss={() => dismiss(i)} />
      ))}
    </div>
  );
};

export default ConfigWarnings;
