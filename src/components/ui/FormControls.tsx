// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Barrel re-export for dark-themed form controls.
 *
 * Each component now lives in its own file for maintainability:
 *  - DarkFormField.tsx
 *  - DarkInput.tsx
 *  - DarkAutosuggest.tsx
 *  - DarkSelect.tsx
 *  - DarkMultiselect.tsx
 *  - types.ts (shared types)
 *
 * This file preserves the original import path so consumers
 * (`import { DarkInput } from "../ui/FormControls"`) keep working.
 */

import "./FormControls.css";

export { DarkFormField } from "./DarkFormField";
export { DarkInput } from "./DarkInput";
export { DarkAutosuggest } from "./DarkAutosuggest";
export { DarkSelect } from "./DarkSelect";
export { DarkMultiselect } from "./DarkMultiselect";
export type { LoadingStatus, OptionItem, LabeledOption } from "./types";
