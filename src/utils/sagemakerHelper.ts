// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** SageMaker endpoint discovery for model selection. */

import {
  EndpointSummary,
  ListEndpointsCommand,
  SageMakerClient
} from "@aws-sdk/client-sagemaker";

import { getAWSCreds, isCredentialError, REGION } from "@/config";
import { logger } from "@/utils/logger";

/**
 * Retrieves a list of all SageMaker endpoints.
 *
 * @param setShowCredsExpiredAlert - Callback to surface credential expiry to the UI.
 * @returns Array of endpoint names, or undefined if none exist.
 */
export async function getListOfSMEndpoints(
  setShowCredsExpiredAlert: (arg0: boolean) => void
): Promise<(string | undefined)[] | undefined> {
  try {
    const client: SageMakerClient = new SageMakerClient({
      region: REGION,
      credentials: getAWSCreds()
    });

    const { Endpoints: endpointObjectList }: { Endpoints?: EndpointSummary[] } =
      await client.send(new ListEndpointsCommand({}));

    if (!endpointObjectList || endpointObjectList.length === 0) {
      logger.warn("Your account does not contain any SageMaker endpoints.");
      return;
    }

    return endpointObjectList.map(
      (endpoint: EndpointSummary) => endpoint.EndpointName
    );
  } catch (e: unknown) {
    logger.error("Failed to list SageMaker endpoints:", e);
    if (isCredentialError(e)) {
      setShowCredsExpiredAlert(true);
    }
  }
  return;
}
