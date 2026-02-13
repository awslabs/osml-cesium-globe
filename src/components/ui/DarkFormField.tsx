// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Dark-themed form field wrapper with label and optional description.
 */

import React from "react";

interface DarkFormFieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export const DarkFormField: React.FC<DarkFormFieldProps> = ({
  label,
  description,
  children
}) => (
  <div className="df-field">
    <label className="df-label">{label}</label>
    {description && <div className="df-description">{description}</div>}
    <div className="df-control">{children}</div>
  </div>
);
