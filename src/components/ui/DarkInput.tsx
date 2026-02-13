// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Minimal dark-themed text/number input component.
 */

import React from "react";

interface DarkInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  inputMode?: "text" | "numeric" | "decimal";
  disabled?: boolean;
}

export const DarkInput: React.FC<DarkInputProps> = ({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  disabled = false
}) => (
  <input
    className={`df-input ${disabled ? "df-input--disabled" : ""}`}
    type={type}
    inputMode={inputMode}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
  />
);
