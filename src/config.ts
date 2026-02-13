// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Application-wide configuration constants, AWS credential helpers, and region resolution. */

import { join } from "node:path";

import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { Color } from "cesium";
import { ConfigIniParser } from "config-ini-parser";
import { readFileSync } from "fs";
import { homedir } from "os";

// local resources
export const LOCAL_GEOJSON_FOLDER: string = "src/data/geojson/";
export const LOCAL_IMAGE_DATA_FOLDER: string = "src/data/images/";
export const CESIUM_IMAGERY_TILES_FOLDER: string = "src/data/tiles/imagery/";
export const CESIUM_TERRAIN_TILES_FOLDER: string = "src/data/tiles/terrain/";

export const DDB_JOB_STATUS_TABLE: string = "ImageProcessingJobStatus";

// queue names
export const SQS_IMAGE_REQUEST_QUEUE: string = "ImageRequestQueue";
export const SQS_IMAGE_STATUS_QUEUE: string = "ImageStatusQueue";

// bucket name prefixes
export const S3_RESULTS_BUCKET_PREFIX: string = "mr-bucket-sink";

// stream name prefixes
export const KINESIS_RESULTS_STREAM_PREFIX: string = "mr-stream-sink";

// deployment info — resolved from standard AWS sources, falls back to us-west-2
export type RegionSource = "AWS_REGION" | "AWS_DEFAULT_REGION" | "aws-config" | "default";

interface RegionResolution {
  region: string;
  source: RegionSource;
}

function resolveRegion(): RegionResolution {
  // 1. Environment variables (same precedence the AWS SDK uses)
  if (process.env.AWS_REGION)
    return { region: process.env.AWS_REGION, source: "AWS_REGION" };
  if (process.env.AWS_DEFAULT_REGION)
    return { region: process.env.AWS_DEFAULT_REGION, source: "AWS_DEFAULT_REGION" };

  // 2. ~/.aws/config [default] profile
  try {
    const configPath = join(homedir(), ".aws", "config");
    const configContents = readFileSync(configPath, "utf-8");
    const parser = new ConfigIniParser();
    parser.parse(configContents);
    const region = parser.get("default", "region", undefined) as
      | string
      | undefined;
    if (region) return { region: region.trim(), source: "aws-config" };
  } catch {
    // Config file missing or unreadable — fall through to default
  }

  return { region: "us-west-2", source: "default" };
}

const regionResolution = resolveRegion();
export const REGION: string = regionResolution.region;
export const REGION_SOURCE: RegionSource = regionResolution.source;

// ── AWS configuration diagnostics ──────────────────────────────────────────

/** A diagnostic warning about AWS configuration issues. */
export interface ConfigWarning {
  severity: "error" | "warning";
  title: string;
  message: string;
}

/** Synchronous check for file-level issues (missing creds file, region fallback). */
function getStaticWarnings(): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];

  // Check credentials file exists and has keys
  try {
    const creds = getAWSCreds();
    if (!creds || !creds.accessKeyId || !creds.secretAccessKey) {
      warnings.push({
        severity: "error",
        title: "AWS Credentials Missing",
        message:
          "No valid credentials found in ~/.aws/credentials. S3, SageMaker, and other AWS features will not work."
      });
    }
  } catch {
    warnings.push({
      severity: "error",
      title: "AWS Credentials Not Found",
      message:
        "Could not read ~/.aws/credentials. Configure your AWS CLI credentials to enable AWS features."
    });
  }

  // Check region fallback
  if (REGION_SOURCE === "default") {
    warnings.push({
      severity: "warning",
      title: "Using Default Region",
      message: `No AWS region configured — falling back to ${REGION}. Set AWS_REGION or configure ~/.aws/config to change this.`
    });
  }

  return warnings;
}

/**
 * Full config check: synchronous file checks + async STS validation.
 * Returns all warnings (file-level + credential validity).
 */
export async function getConfigWarnings(): Promise<ConfigWarning[]> {
  const warnings = getStaticWarnings();

  // If creds file is missing/empty, skip the live check — already reported
  const hasCredsFileError = warnings.some(
    (w) => w.severity === "error" && w.title.startsWith("AWS Credentials")
  );

  if (!hasCredsFileError) {
    try {
      await new STSClient({
        region: REGION,
        credentials: getAWSCreds()
      }).send(new GetCallerIdentityCommand({}));
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name ?? "";
      const isExpired =
        name === "ExpiredToken" ||
        name === "ExpiredTokenException" ||
        name === "RequestExpired";

      warnings.push({
        severity: "error",
        title: isExpired ? "AWS Credentials Expired" : "AWS Credentials Invalid",
        message: isExpired
          ? "Your AWS session token has expired. Refresh your credentials and restart the application."
          : "Could not authenticate with AWS. Verify your credentials in ~/.aws/credentials are correct."
      });
    }
  }

  return warnings;
}

// ── Credential error detection (used by helpers) ───────────────────────────

/** Known AWS SDK error names related to authentication / authorization failures */
const CREDENTIAL_ERROR_NAMES = new Set([
  "ExpiredToken",
  "ExpiredTokenException",
  "RequestExpired",
  "InvalidClientTokenId",
  "UnrecognizedClientException",
  "InvalidIdentityToken",
  "AccessDeniedException",
  "AuthFailure",
  "SignatureDoesNotMatch",
  "IncompleteSignature"
]);

/** Returns true if the error is an AWS credentials / auth error. */
export function isCredentialError(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? "";
  if (CREDENTIAL_ERROR_NAMES.has(name)) return true;

  // Fallback: check for common HTTP status codes from auth failures
  const statusCode = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
  return statusCode === 400 || statusCode === 401 || statusCode === 403;
}

/** AWS credential set parsed from ~/.aws/credentials. */
interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | undefined;
}

/** Reads AWS credentials from the default profile in ~/.aws/credentials. */
export function getAWSCreds(): Credentials | undefined {
  // Grab the AWS credentials from the file system
  const fileContents: string = readFileSync(
    join(homedir(), ".aws", "credentials"),
    "utf-8"
  );
  const parser: ConfigIniParser = new ConfigIniParser();
  parser.parse(fileContents);

  // looks for creds under the 'default' profile of the aws/credentials file
  return {
    accessKeyId: <string>parser.get("default", "aws_access_key_id"),
    secretAccessKey: <string>parser.get("default", "aws_secret_access_key"),
    sessionToken: <string | undefined>(
      parser.get("default", "aws_session_token", undefined)
    )
  };
}

const getAWSAccountId = async (): Promise<string> => {
  const response = await new STSClient({
    region: REGION,
    credentials: getAWSCreds()
  }).send(new GetCallerIdentityCommand({}));
  return String(response.Account);
};

// Export a function to get the account ID instead of using top-level await
export const getAccountId = async (): Promise<string> => {
  return await getAWSAccountId();
};

// default image request values
export const DEFAULT_MODEL_INVOKE_MODE: string = "SM_ENDPOINT";
export const DEFAULT_TILE_FORMAT: string = "GTIFF";
export const DEFAULT_TILE_COMPRESSION: string = "NONE";
export const DEFAULT_TILE_SIZE: number = 512;
export const DEFAULT_TILE_OVERLAP: number = 128;
export const DEFAULT_FEATURE_DISTILLATION_ALGORITHM: string = "NMS";
export const DEFAULT_FEATURE_DISTILLATION_IOU_THRESHOLD: number = 0.1;
export const DEFAULT_FEATURE_DISTILLATION_SKIP_BOX_THRESHOLD: number = 0.2;
export const DEFAULT_FEATURE_DISTILLATION_SIGMA: number = 0.1;
export const DEFAULT_RESULTS_COLOR_OPTION: { label: string; value: string } = {
  label: "Yellow",
  value: Color.YELLOW.toCssColorString()
};
export const DEFAULT_RESULTS_LINE_ALPHA: number = 0.9;
export const DEFAULT_RESULTS_FILL_ALPHA: number = 0.3;

export const ZOOM_MAX: number = 18;
export const ZOOM_MIN: number = 7;

// sqs retry
export const MONITOR_IMAGE_STATUS_RETRIES: number = 1000;
export const MONITOR_IMAGE_STATUS_INTERVAL_SECONDS: number = 5;

// viewer initialization retry
export const VIEWER_INIT_MAX_RETRIES: number = 20;
export const VIEWER_INIT_RETRY_DELAY_MS: number = 200;

// camera animation
export const CAMERA_FLY_DURATION_SECONDS: number = 2.0;
export const CAMERA_FLY_DELAY_MS: number = 1000;

// feature popup dimensions
export const POPUP_WIDTH: number = 320;
export const POPUP_MAX_HEIGHT: number = 360;
export const POPUP_MARGIN: number = 12;
export const POPUP_VERTICAL_OFFSET: number = 30;

// job naming
export const JOB_NAME_PREFIX: string = "test_";

// fallback dev server URL (used when window.location.origin is unavailable)
export const FALLBACK_DEV_URL: string = "http://localhost:5173";
