// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Custom dark-themed select dropdown component.
 */

import React, { useEffect, useRef, useState } from "react";

import type { LabeledOption } from "./types";

interface DarkSelectProps {
  value: LabeledOption | null;
  onChange: (option: LabeledOption) => void;
  options: LabeledOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Custom renderer for each option in the dropdown */
  renderOption?: (option: LabeledOption) => React.ReactNode;
  /** Custom renderer for the selected value in the trigger */
  renderValue?: (option: LabeledOption) => React.ReactNode;
}

export const DarkSelect: React.FC<DarkSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  renderOption,
  renderValue
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement;
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (highlightIdx >= 0 && options[highlightIdx]) {
          onChange(options[highlightIdx]);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="df-select" ref={wrapperRef}>
      <button
        type="button"
        className={`df-select-trigger ${disabled ? "df-input--disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span className={value ? "df-select-value" : "df-select-placeholder"}>
          {value ? (renderValue ? renderValue(value) : value.label) : placeholder}
        </span>
        <svg
          className={`df-autosuggest-chevron ${isOpen ? "df-autosuggest-chevron--open" : ""}`}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="df-dropdown">
          <ul className="df-dropdown-list" ref={listRef}>
            {options.map((opt, i) => (
              <li
                key={opt.value}
                className={`df-dropdown-item ${
                  i === highlightIdx ? "df-dropdown-item--highlight" : ""
                } ${value?.value === opt.value ? "df-dropdown-item--selected" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightIdx(i)}
              >
                {renderOption ? renderOption(opt) : opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
