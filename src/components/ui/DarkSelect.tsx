// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Custom dark-themed select dropdown component.
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(220);
  const [openUpward, setOpenUpward] = useState(false);

  /** Positions the dropdown to avoid clipping in scrollable containers. */
  const updateDropdownPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spacing = 4;
    const maxHeight = 220;
    const minHeight = 120;
    const viewportPadding = 8;
    const spaceAbove = rect.top - spacing - viewportPadding;
    const spaceBelow = window.innerHeight - rect.bottom - spacing - viewportPadding;

    const shouldOpenUpward = spaceBelow < minHeight && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUpward ? spaceAbove : spaceBelow;
    const computedMaxHeight = Math.max(
      Math.min(maxHeight, availableSpace),
      Math.min(minHeight, Math.max(spaceAbove, spaceBelow))
    );

    setOpenUpward(shouldOpenUpward);
    setDropdownMaxHeight(computedMaxHeight);
    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: "var(--z-dropdown)",
      top: shouldOpenUpward ? rect.top - spacing : rect.bottom + spacing,
      transform: shouldOpenUpward ? "translateY(-100%)" : "none"
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsideWrapper = !!wrapperRef.current?.contains(target);
      const clickedInsideDropdown = !!dropdownRef.current?.contains(target);
      if (!clickedInsideWrapper && !clickedInsideDropdown) {
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

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const handleViewportChange = () => updateDropdownPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

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
        ref={triggerRef}
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

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`df-dropdown df-dropdown--portal ${openUpward ? "df-dropdown--upward" : ""}`}
            style={dropdownStyle}
          >
            <ul className="df-dropdown-list" ref={listRef} style={{ maxHeight: dropdownMaxHeight }}>
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
          </div>,
          document.body
        )}
    </div>
  );
};
