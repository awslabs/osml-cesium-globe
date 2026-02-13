// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Feature property formatting utilities for the Cesium viewer.
 * Structures raw GeoJSON feature properties into display-ready groups.
 */

/**
 * A single key-value entry in a property group.
 * Nested objects are represented as children instead of a flat string.
 */
export interface PropertyEntry {
  key: string;
  value: string;
  /** Nested sub-entries for object values */
  children?: PropertyEntry[];
}

/**
 * A named group of property entries.
 */
export interface PropertyGroup {
  group: string;
  entries: PropertyEntry[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Formats feature properties into structured groups for display.
 * @param properties - The raw feature properties
 * @returns An array of PropertyGroup objects
 */
export function formatFeatureProperties(properties: Record<string, any>): PropertyGroup[] {
  const GROUPS: Record<string, string[]> = {
    CLASSIFICATION: ['class', 'feature', 'score', 'confidence'],
    LOCATION: ['longitude', 'latitude', 'altitude', 'height', 'width'],
    METADATA: ['inference', 'date', 'time', 'timestamp', 'version']
  };

  const SKIP_PROPERTIES = [
    'coordinates', 'geometry', 'type', 'id', 'center longitude', 'center latitude',
    'bbox', 'bounds', 'shape'
  ];

  const SENSITIVE_PROPERTIES = ['password', 'secret', 'key', 'token'];
  const MAX_VALUE_LENGTH = 100;

  const grouped: Record<string, PropertyEntry[]> = {
    CLASSIFICATION: [],
    LOCATION: [],
    METADATA: [],
    OTHER: []
  };

  /** Format a primitive/scalar value into a display string. */
  const formatScalar = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';

    if (typeof value === 'number') {
      if (value > 0.99 || value < -0.99) {
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
      }
      return value.toFixed(4);
    }

    if (value instanceof Date || (typeof value === 'string' && value.includes('202'))) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date.toLocaleString();
      } catch { /* keep original */ }
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '';
      if (typeof value[0] === 'number' || Array.isArray(value[0])) return '';
      return value.map(v => formatScalar(v)).filter(v => v !== '').join(', ');
    }

    // Objects: flatten key-value pairs into a readable string
    if (typeof value === 'object') {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(value)) {
        const fk = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ').trim();
        parts.push(`${fk}: ${formatScalar(v)}`);
      }
      return parts.join(', ') || 'N/A';
    }

    return String(value);
  };

  const formatKey = (k: string): string =>
    k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ').trim();

  /** Convert a value into a PropertyEntry, expanding nested objects/arrays into children. */
  const toEntry = (key: string, value: any, depth: number = 0): PropertyEntry | null => {
    if (value === null || value === undefined) return { key, value: 'N/A' };

    // Nested objects become entries with children
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (depth >= 3) return { key, value: formatScalar(value) };

      const children: PropertyEntry[] = [];
      for (const [k, v] of Object.entries(value)) {
        if (SKIP_PROPERTIES.some(p => k.toLowerCase().includes(p.toLowerCase()))) continue;
        if (SENSITIVE_PROPERTIES.some(p => k.toLowerCase().includes(p))) continue;
        const child = toEntry(formatKey(k), v, depth + 1);
        if (child) children.push(child);
      }
      if (children.length === 0) return null;
      return { key, value: '', children };
    }

    // Arrays of objects: each element becomes a numbered child with its own sub-entries
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      if (typeof value[0] === 'number' || Array.isArray(value[0])) return null;

      // If elements are objects, expand into numbered children
      if (typeof value[0] === 'object') {
        if (depth >= 3) return { key, value: formatScalar(value) };

        const children: PropertyEntry[] = [];
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          const itemLabel = value.length === 1 ? key : `${key} ${i + 1}`;
          const child = toEntry(itemLabel, item, depth + 1);
          if (child) children.push(child);
        }
        // If single-element array, just hoist the children up
        if (children.length === 1 && children[0].children) {
          return { key, value: '', children: children[0].children };
        }
        if (children.length === 0) return null;
        return { key, value: '', children };
      }

      // Array of scalars
      const formatted = value.map(v => formatScalar(v)).filter(v => v !== '').join(', ');
      return formatted ? { key, value: formatted } : null;
    }

    const formatted = formatScalar(value);
    if (formatted === '') return null;
    return { key, value: formatted };
  };

  const getGroup = (key: string): string => {
    const lower = key.toLowerCase();
    for (const [group, keywords] of Object.entries(GROUPS)) {
      if (keywords.some(kw => lower.includes(kw))) return group;
    }
    return 'OTHER';
  };

  for (const [key, value] of Object.entries(properties)) {
    if (SKIP_PROPERTIES.some(p => key.toLowerCase().includes(p.toLowerCase()))) continue;
    if (SENSITIVE_PROPERTIES.some(p => key.toLowerCase().includes(p))) continue;
    if (Array.isArray(value) && value.length > 0 && (typeof value[0] === 'number' || Array.isArray(value[0]))) continue;

    let displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, ' ').trim();
    if (displayKey.toLowerCase().includes('dt')) displayKey = displayKey.replace('DT', 'Date/Time');
    if (displayKey.toLowerCase().includes('inference metadata')) displayKey = 'Inference Time';
    if (displayKey.toLowerCase().includes('inference d t')) displayKey = 'Inference Time';

    // Special case: feature_classes -> extract IRI + Score into CLASSIFICATION
    if (displayKey.toLowerCase() === 'feature classes' && typeof value === 'object') {
      const items = Array.isArray(value) ? value : [value];
      let handled = false;
      for (const item of items) {
        if (item && typeof item === 'object') {
          const iri = item.iri || item.Iri || item.IRI;
          const score = item.score || item.Score;
          if (iri !== undefined) {
            grouped['CLASSIFICATION'].push({ key: 'IRI', value: String(iri) });
          }
          if (score !== undefined) {
            grouped['CLASSIFICATION'].push({ key: 'Score', value: formatScalar(score) });
          }
          if (iri !== undefined || score !== undefined) handled = true;
          // Add any remaining keys as children
          const otherChildren: PropertyEntry[] = [];
          for (const [k, v] of Object.entries(item)) {
            if (['iri', 'score'].includes(k.toLowerCase())) continue;
            const child = toEntry(formatKey(k), v, 1);
            if (child) otherChildren.push(child);
          }
          if (otherChildren.length > 0) {
            grouped['CLASSIFICATION'].push(...otherChildren);
          }
        }
      }
      if (handled) continue;
    }

    const entry = toEntry(displayKey, value);
    if (!entry) continue;

    // Truncate flat values
    if (entry.value && entry.value.length > MAX_VALUE_LENGTH) {
      entry.value = entry.value.substring(0, MAX_VALUE_LENGTH) + '...';
    }

    // Clean up inference time value
    if (displayKey === 'Inference Time' && entry.value.includes('Inference D T:')) {
      entry.value = entry.value.replace('Inference D T:', '').trim();
    }

    grouped[getGroup(key)].push(entry);
  }

  // Return only non-empty groups, in order
  return Object.entries(grouped)
    .filter(([, entries]) => entries.length > 0)
    .map(([group, entries]) => ({ group, entries }));
}
