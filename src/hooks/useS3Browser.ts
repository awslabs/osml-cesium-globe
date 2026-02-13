// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Custom hook that encapsulates the shared S3 bucket/object browsing logic
 * used across LoadImageModal, LoadDataModal, and ImageRequestModal.
 *
 * Provides bucket listing on mount, object listing on bucket selection,
 * and built-in credential error handling.
 */

import { Bucket, _Object } from "@aws-sdk/client-s3";
import { useCallback, useEffect, useState } from "react";

import { isCredentialError } from "@/config";
import { logger } from "@/utils/logger";
import { getListOfS3Buckets, getListOfS3Objects } from "@/utils/s3Helper";

import type { LoadingStatus } from "@/components/ui/FormControls";

/** A simple { value: string } item for the autosuggest components. */
export interface S3BrowserOption {
  value: string;
}

export interface UseS3BrowserOptions {
  /** When true the hook will fetch buckets. Pass the modal's visibility flag. */
  enabled: boolean;
  /** Callback to show the credential-expired alert. */
  setShowCredsExpiredAlert: (show: boolean) => void;
  /**
   * Optional filter predicate applied to S3 object keys.
   * For example, filter to only `.geojson` or image extensions.
   * Defaults to accepting all keys.
   */
  objectFilter?: (key: string) => boolean;
}

export interface UseS3BrowserReturn {
  /** Current list of bucket options. */
  buckets: S3BrowserOption[];
  /** Loading status for bucket list. */
  bucketStatus: LoadingStatus;
  /** Current list of object options (filtered). */
  objects: S3BrowserOption[];
  /** Loading status for object list. */
  objectStatus: LoadingStatus;
  /** Call this when the user selects / types a bucket. Fetches objects. */
  loadObjects: (bucket: string) => Promise<void>;
  /** Reset object list (e.g. when bucket changes). */
  resetObjects: () => void;
}

/**
 * Shared hook for browsing S3 buckets and objects.
 */
export function useS3Browser({
  enabled,
  setShowCredsExpiredAlert,
  objectFilter
}: UseS3BrowserOptions): UseS3BrowserReturn {
  const [buckets, setBuckets] = useState<S3BrowserOption[]>([]);
  const [bucketStatus, setBucketStatus] = useState<LoadingStatus>("pending");
  const [objects, setObjects] = useState<S3BrowserOption[]>([]);
  const [objectStatus, setObjectStatus] = useState<LoadingStatus>("pending");

  // Fetch buckets when enabled changes to true
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    (async () => {
      try {
        setBucketStatus("loading");
        const res = await getListOfS3Buckets(setShowCredsExpiredAlert);
        if (cancelled) return;
        if (res && res.length > 0) {
          setBuckets(
            res
              .filter((b): b is Bucket & { Name: string } => !!b?.Name)
              .map((b) => ({ value: b.Name }))
          );
          setBucketStatus("finished");
        } else {
          setBucketStatus("error");
        }
      } catch (e: unknown) {
        if (cancelled) return;
        logger.error("Error loading S3 buckets:", e);
        handleAwsError(e, setShowCredsExpiredAlert);
        setBucketStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, setShowCredsExpiredAlert]);

  const loadObjects = useCallback(
    async (bucket: string) => {
      try {
        setObjectStatus("loading");
        const res = await getListOfS3Objects(bucket, setShowCredsExpiredAlert);
        if (res && Array.isArray(res) && res.length > 0) {
          let keys = (res as _Object[])
            .filter((o): o is _Object & { Key: string } => !!o.Key)
            .map((o) => o.Key);

          if (objectFilter) {
            keys = keys.filter(objectFilter);
          }

          setObjects(keys.map((k) => ({ value: k })));
          setObjectStatus("finished");
        } else {
          setObjectStatus("error");
        }
      } catch (e: unknown) {
        logger.error("Error loading S3 objects:", e);
        handleAwsError(e, setShowCredsExpiredAlert);
        setObjectStatus("error");
      }
    },
    [setShowCredsExpiredAlert, objectFilter]
  );

  const resetObjects = useCallback(() => {
    setObjects([]);
    setObjectStatus("pending");
  }, []);

  return { buckets, bucketStatus, objects, objectStatus, loadObjects, resetObjects };
}

/* ─────────────────────────────────────────────────────────────────────
   Shared credential error handler
   ───────────────────────────────────────────────────────────────────── */

/**
 * Checks whether an error is an AWS credential error and triggers the
 * credential-expired alert if so. Safe to call with any error type.
 */
export function handleAwsError(
  e: unknown,
  setShowCredsExpiredAlert: (show: boolean) => void
): void {
  if (isCredentialError(e)) {
    setShowCredsExpiredAlert(true);
  }
}
