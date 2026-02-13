// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** S3 bucket and object operations (list, download) for the application. */

import {
  _Object,
  Bucket,
  GetObjectCommand,
  GetObjectCommandOutput,
  ListBucketsCommand,
  ListBucketsCommandOutput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  S3Client
} from "@aws-sdk/client-s3";

import { getAWSCreds, isCredentialError, REGION } from "@/config";
import { logger } from "@/utils/logger";

const s3Client: S3Client = new S3Client({
  region: REGION,
  credentials: () => {
    const creds = getAWSCreds();
    if (!creds) return Promise.reject(new Error("No AWS credentials found"));
    return Promise.resolve(creds);
  }
});

/**
 * Fetch the list of S3 Buckets.
 *
 * @param setShowCredsExpiredAlert - Callback to surface credential expiry to the UI.
 * @returns Array of Buckets, or null on failure.
 */
export async function getListOfS3Buckets(
  setShowCredsExpiredAlert: (value: boolean) => void
): Promise<Array<Bucket | undefined> | null> {
  try {
    const s3Responses: ListBucketsCommandOutput = await s3Client.send(
      new ListBucketsCommand({})
    );

    if (s3Responses) {
      const s3BucketsObjectList: Bucket[] | undefined = s3Responses["Buckets"];
      const s3BucketsList: (Bucket | undefined)[] = [];

      if (s3BucketsObjectList) {
        s3BucketsObjectList.forEach((bucket: Bucket) => {
          s3BucketsList.push(bucket);
        });
        return s3BucketsList;
      } else {
        logger.warn("Your S3 account does not contain any buckets.");
      }
    } else {
      logger.error("Cannot fetch buckets from S3. Please verify your roles/permissions.");
    }
  } catch (e: unknown) {
    logger.error("Failed to list S3 buckets:", e);
    if (isCredentialError(e)) {
      setShowCredsExpiredAlert(true);
    }
  }

  return null;
}

/**
 * Fetch the list of S3 Objects from a specified Bucket.
 *
 * @param bucketName - The name of the bucket to fetch objects from.
 * @param setShowCredsExpiredAlert - Callback to surface credential expiry to the UI.
 * @returns Array of S3 objects, or null on failure.
 */
export async function getListOfS3Objects(
  bucketName: string,
  setShowCredsExpiredAlert: (value: boolean) => void
): Promise<Array<_Object> | string | null> {
  try {
    const s3Responses: ListObjectsV2CommandOutput = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucketName })
    );
    const s3ObjectsList: _Object[] | undefined = s3Responses["Contents"];

    if (s3ObjectsList) {
      return s3ObjectsList;
    } else {
      logger.warn("Cannot fetch S3 Objects from this bucket: " + bucketName);
    }
  } catch (e: unknown) {
    logger.error(`Failed to list objects in bucket "${bucketName}":`, e);
    if (isCredentialError(e)) {
      setShowCredsExpiredAlert(true);
    }
  }

  return null;
}

/**
 * Load a specified S3 Object.
 *
 * @param s3Object - The S3 object descriptor (name, bucket, date).
 * @param setShowCredsExpiredAlert - Callback to surface credential expiry to the UI.
 * @param asBinary - If true, the object is returned as a Uint8Array; otherwise as a string.
 * @returns The object contents, or null on failure.
 */
export async function loadS3Object(
  s3Object: {
    name: string;
    bucket: string;
    date: string;
  },
  setShowCredsExpiredAlert: (value: boolean) => void,
  asBinary?: boolean
): Promise<string | Uint8Array | null> {
  // TODO: Convert argument into list and download S3 objects to local drive
  try {
    const response: GetObjectCommandOutput = await s3Client.send(
      new GetObjectCommand({ Bucket: s3Object.bucket, Key: s3Object.name })
    );

    if (response["Body"]) {
      if (asBinary) {
        return await response["Body"]?.transformToByteArray();
      } else {
        return new TextDecoder().decode(
          await response["Body"]?.transformToByteArray()
        );
      }
    }
  } catch (e: unknown) {
    logger.error(`Failed to load S3 object "${s3Object.name}":`, e);
    if (isCredentialError(e)) {
      setShowCredsExpiredAlert(true);
    }
  }

  return null;
}
