// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React, { useEffect, useRef } from "react";
import "./DarkModal.css";

interface DarkModalProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const DarkModal: React.FC<DarkModalProps> = ({
  visible,
  onDismiss,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md"
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div className="dm-overlay" onClick={onDismiss}>
      <div
        ref={panelRef}
        className={`dm-panel dm-panel--${size}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dm-header">
          <div className="dm-header-left">
            {icon && <div className="dm-header-icon">{icon}</div>}
            <div className="dm-header-text">
              <h2 className="dm-title">{title}</h2>
              {subtitle && <p className="dm-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button className="dm-close" onClick={onDismiss} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="dm-body">{children}</div>

        {/* Footer */}
        {footer && <div className="dm-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default DarkModal;
