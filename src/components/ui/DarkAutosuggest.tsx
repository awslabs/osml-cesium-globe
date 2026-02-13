// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Dark-themed autosuggest input with dropdown filtering and keyboard navigation.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { LoadingStatus, OptionItem } from "./types";

interface DarkAutosuggestProps {
  value: string;
  onChange: (value: string) => void;
  options: OptionItem[];
  placeholder?: string;
  status?: LoadingStatus;
  loadingText?: string;
  errorText?: string;
  empty?: string;
  disabled?: boolean;
}

export const DarkAutosuggest: React.FC<DarkAutosuggestProps> = ({
  value,
  onChange,
  options,
  placeholder,
  status = "finished",
  loadingText = "Loading...",
  errorText = "Error loading data",
  empty = "No results",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter options based on current input value
  const filtered = useMemo(() => {
    if (!value) return options;
    const lower = value.toLowerCase();
    return options.filter(
      (o) =>
        o.value.toLowerCase().includes(lower) ||
        o.label?.toLowerCase().includes(lower)
    );
  }, [value, options]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIdx(-1);
  }, [filtered.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement;
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      setHighlightIdx(-1);
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIdx >= 0 && filtered[highlightIdx]) {
          handleSelect(filtered[highlightIdx].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const showDropdown =
    isOpen && (status === "loading" || status === "error" || filtered.length > 0 || (status === "finished" && options.length === 0));

  return (
    <div className="df-autosuggest" ref={wrapperRef}>
      <input
        className={`df-input ${disabled ? "df-input--disabled" : ""}`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />

      {/* Dropdown chevron */}
      <svg
        className={`df-autosuggest-chevron ${isOpen ? "df-autosuggest-chevron--open" : ""}`}
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {showDropdown && (
        <div className="df-dropdown">
          {status === "loading" ? (
            <div className="df-dropdown-status">
              <span className="df-dropdown-spinner" />
              {loadingText}
            </div>
          ) : status === "error" ? (
            <div className="df-dropdown-status df-dropdown-status--error">
              {errorText}
            </div>
          ) : filtered.length === 0 ? (
            <div className="df-dropdown-status">{empty}</div>
          ) : (
            <ul className="df-dropdown-list" ref={listRef}>
              {filtered.map((opt, i) => (
                <li
                  key={opt.value}
                  className={`df-dropdown-item ${
                    i === highlightIdx ? "df-dropdown-item--highlight" : ""
                  } ${opt.value === value ? "df-dropdown-item--selected" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt.value);
                  }}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  {opt.label || opt.value}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
