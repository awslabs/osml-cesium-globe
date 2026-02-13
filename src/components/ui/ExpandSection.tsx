// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * A collapsible/expandable section with a header and chevron indicator.
 * Used in modals and forms to group optional fields.
 */

import React, { useState } from "react";

interface ExpandSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const ExpandSection: React.FC<ExpandSectionProps> = ({
  title,
  children,
  defaultOpen = false
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`dm-expand ${open ? "dm-expand--open" : ""}`}>
      <button className="dm-expand-header" onClick={() => setOpen(!open)} type="button">
        <span>{title}</span>
        <svg className="dm-expand-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="dm-expand-body">{children}</div>}
    </div>
  );
};

export default ExpandSection;
