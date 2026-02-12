// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.
// Custom dark-themed form controls replacing CloudScape components.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import "./FormControls.css";

/* ============================================================
   Types
   ============================================================ */

export type LoadingStatus = "pending" | "loading" | "finished" | "error";

export interface OptionItem {
  value: string;
  label?: string;
}

export interface LabeledOption {
  label: string;
  value: string;
}

/* ============================================================
   DarkFormField
   ============================================================ */

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

/* ============================================================
   DarkInput
   ============================================================ */

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

/* ============================================================
   DarkAutosuggest
   The main complex component — replaces CloudScape Autosuggest.
   Supports async loading states, filtering, keyboard nav.
   ============================================================ */

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

/* ============================================================
   DarkSelect
   Simple single-value select dropdown.
   ============================================================ */

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

/* ============================================================
   DarkMultiselect
   Multi-value select with checkboxes.
   ============================================================ */

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
