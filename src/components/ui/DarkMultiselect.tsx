// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React, { useEffect, useRef, useState } from "react";

import type { LabeledOption } from "./types";

interface DarkMultiselectProps {
  selectedOptions: LabeledOption[];
  onChange: (options: LabeledOption[]) => void;
  options: LabeledOption[];
  placeholder?: string;
}

export const DarkMultiselect: React.FC<DarkMultiselectProps> = ({
  selectedOptions,
  onChange,
  options,
  placeholder = "Select..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isSelected = (val: string) =>
    selectedOptions.some((o) => o.value === val);

  const toggle = (opt: LabeledOption) => {
    if (isSelected(opt.value)) {
      onChange(selectedOptions.filter((o) => o.value !== opt.value));
    } else {
      onChange([...selectedOptions, opt]);
    }
  };

  const removeTag = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedOptions.filter((o) => o.value !== val));
  };

  return (
    <div className="df-multiselect" ref={wrapperRef}>
      <button
        type="button"
        className="df-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOptions.length === 0 ? (
          <span className="df-select-placeholder">{placeholder}</span>
        ) : (
          <div className="df-tags">
            {selectedOptions.map((opt) => (
              <span key={opt.value} className="df-tag">
                {opt.label}
                <svg
                  className="df-tag-remove"
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  onMouseDown={(e) => removeTag(opt.value, e)}
                >
                  <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </span>
            ))}
          </div>
        )}
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
          <ul className="df-dropdown-list">
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`df-dropdown-item df-dropdown-item--check ${
                  isSelected(opt.value) ? "df-dropdown-item--selected" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggle(opt);
                }}
              >
                <span className={`df-checkbox ${isSelected(opt.value) ? "df-checkbox--checked" : ""}`}>
                  {isSelected(opt.value) && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
