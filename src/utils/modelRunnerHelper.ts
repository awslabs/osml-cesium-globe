// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import React from "react";
import {
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient
} from "@aws-sdk/client-sqs";

import {
  getAccountId,
  getAWSCreds,
  JOB_NAME_PREFIX,
  KINESIS_RESULTS_STREAM_PREFIX,
  MONITOR_IMAGE_STATUS_INTERVAL_SECONDS,
  MONITOR_IMAGE_STATUS_RETRIES,
  REGION,
  S3_RESULTS_BUCKET_PREFIX,
  SQS_IMAGE_REQUEST_QUEUE,
  SQS_IMAGE_STATUS_QUEUE
} from "@/config";
import type {
  FeatureDistillationConfig,
  ImageProcessor,
  ImageRequestOutput,
  ImageRequestState,
  PostProcessingStep
} from "@/types";
import { logger } from "@/utils/logger";

export interface ImageRequest {
  jobId: string;
  jobName: string;
  imageUrls: string[];
  outputs: ImageRequestOutput[];
  imageProcessor: ImageProcessor;
  imageProcessorParameters?: { CustomAttributes: string };
  postProcessing: PostProcessingStep[];
  imageProcessorTileSize?: number;
  imageProcessorTileOverlap?: number;
  imageProcessorTileFormat?: string;
  imageProcessorTileCompression?: string;
  imageReadRole?: string;
  regionOfInterest?: string;
  featureProperties?: string;
}

function getSQSClient() {
  return new SQSClient({ region: REGION, credentials: getAWSCreds() });
}

export async function runModelOnImage(
  jobId: string,
  s3Uri: string,
  imageReadRole: string,
  modelValue: string,
  modelInvokeModeValue: string,
  modelInvokeRole: string,
  selectedOutputs: { label: string; value: string }[],
  tileSizeValue: number,
  tileOverlapValue: number,
  formatValue: string,
  compressionValue: string,
  featureDistillationAlgorithm: string,
  featureDistillationIouThreshold: number,
  featureDistillationSkipBoxThreshold: number,
  featureDistillationSigma: number,
  roiWkt: string,
  featureProperties: string,
  textPrompt: string,
  imageRequestStatus: ImageRequestState,
  setImageRequestStatus: React.Dispatch<React.SetStateAction<ImageRequestState>>,
  setShowCredsExpiredAlert: (show: boolean) => void
): Promise<void> {
  setImageRequestStatus({ state: "loading", data: {} });
  const imageProcessingRequest = await buildImageProcessingRequest(
    jobId,
    s3Uri,
    imageReadRole,
    modelValue,
    modelInvokeModeValue,
    modelInvokeRole,
    selectedOutputs,
    tileSizeValue,
    tileOverlapValue,
    formatValue,
    compressionValue,
    featureDistillationAlgorithm,
    featureDistillationIouThreshold,
    featureDistillationSkipBoxThreshold,
    featureDistillationSigma,
    roiWkt,
    featureProperties,
    textPrompt
  );
  await queueImageProcessingJob(
    imageProcessingRequest,
    setShowCredsExpiredAlert
  );
  const jobName = imageProcessingRequest.jobName;
  const outputs = imageProcessingRequest.outputs;

  // Recreate the image_id that will be associated with the image request
  // Note this logic must match the strategy used to construct the image ID in the Model Runner from the
  // image processing request. See AWSOversightMLModelRunner src/aws_oversightml_model_runner/model_runner_api.py
  const imageId = `${jobId}:${imageProcessingRequest.imageUrls[0]}`;
  const resultData = { outputs: outputs, jobId: jobId, jobName: jobName };

  // Monitor the job status queue for updates
  await monitorJobStatus(
    imageId,
    setImageRequestStatus,
    resultData,
    setShowCredsExpiredAlert
  );
}

async function monitorJobStatus(
  imageId: string,
  setImageRequestStatus: React.Dispatch<React.SetStateAction<ImageRequestState>>,
  resultData: { outputs: ImageRequestOutput[]; jobId: string; jobName: string },
  setShowCredsExpiredAlert: (show: boolean) => void
): Promise<boolean> {
  let done: boolean = false;
  try {
    const sqsClient = getSQSClient();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let maxRetries: number = MONITOR_IMAGE_STATUS_RETRIES;
    const retryInterval: number = MONITOR_IMAGE_STATUS_INTERVAL_SECONDS;
    const getUrlCommand = new GetQueueUrlCommand({
      QueueName: SQS_IMAGE_STATUS_QUEUE
    });
    const getUrlResponse = await sqsClient.send(getUrlCommand);
    const queueUrl = getUrlResponse.QueueUrl;
    logger.info("Listening to SQS ImageStatusQueue for progress updates...");

    while (!done && maxRetries > 0) {
      const messagesResponse = await sqsClient.send(
        new ReceiveMessageCommand({ QueueUrl: queueUrl })
      );
      const messages = messagesResponse.Messages;
      if (messages) {
        messages.forEach((message) => {
          if (message.Body) {
            const messageAttributes = JSON.parse(
              message.Body
            ).MessageAttributes;
            const messageImageId = messageAttributes.image_id.Value;
            const messageImageStatus = messageAttributes.status.Value;
            if (
              messageImageStatus == "IN_PROGRESS" &&
              messageImageId == imageId
            ) {
              setImageRequestStatus({ state: "in-progress", data: {} });
              logger.info("IN_PROGRESS message found! Waiting for SUCCESS message...");
            } else if (
              messageImageStatus == "SUCCESS" &&
              messageImageId == imageId
            ) {
              const processingDuration =
                messageAttributes.processing_duration.Value;
              done = true;
              setImageRequestStatus({
                state: "success",
                data: {
                  ...resultData,
                  processingDuration: processingDuration
                }
              });
              logger.info(`SUCCESS message found! Image took ${processingDuration} seconds to process`);
              done = true;
            } else if (
              messageImageStatus == "FAILED" &&
              messageImageId == imageId
            ) {
              const failureMessage = JSON.parse(message.Body).Message;
              setImageRequestStatus({ state: "error", data: {} });
              logger.error(`Failed to process image. ${failureMessage}`);
              done = true;
            } else if (
              messageImageStatus == "PARTIAL" &&
              messageImageId == imageId
            ) {
              const failureMessage = JSON.parse(message.Body).Message;
              setImageRequestStatus({ state: "warning", data: {} });
              logger.warn(`Image processed with errors. ${failureMessage}`);
              done = true;
            }
          }
        });
      } else {
        maxRetries = maxRetries - 1;
        await sleep(retryInterval * 1000);
      }
    }
    if (!done) {
      logger.warn(`Maximum retries reached waiting for ${imageId}`);
    }
    return done;
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "ExpiredToken") {
      setShowCredsExpiredAlert(true);
    } else {
      throw e;
    }
    return done;
  }
}

async function queueImageProcessingJob(
  imageProcessingRequest: ImageRequest,
  setShowCredsExpiredAlert: (show: boolean) => void
): Promise<void> {
  try {
    const sqsClient = getSQSClient();
    const getUrlCommand = new GetQueueUrlCommand({
      QueueName: SQS_IMAGE_REQUEST_QUEUE
    });
    const getUrlResponse = await sqsClient.send(getUrlCommand);
    const queueUrl = getUrlResponse.QueueUrl;
    const input = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(imageProcessingRequest)
    };
    const sendMessageCommand = new SendMessageCommand(input);
    const sendMessageResponse = await sqsClient.send(sendMessageCommand);
    logger.info(`Message queued to SQS with messageId=${sendMessageResponse.MessageId}`);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "ExpiredToken") {
      setShowCredsExpiredAlert(true);
    } else {
      throw e;
    }
  }
}

function build_feature_distillation_obj(
  featureDistillationAlgorithm: string,
  featureDistillationIouThreshold: number,
  featureDistillationSkipBoxThreshold: number,
  featureDistillationSigma: number
): FeatureDistillationConfig {
  if (featureDistillationAlgorithm === "NMS") {
    return {
      algorithmType: featureDistillationAlgorithm,
      iouThreshold: featureDistillationIouThreshold
    };
  } else if (featureDistillationAlgorithm === "SOFT_NMS") {
    return {
      algorithmType: featureDistillationAlgorithm,
      iouThreshold: featureDistillationIouThreshold,
      skipBoxThreshold: featureDistillationSkipBoxThreshold,
      sigma: featureDistillationSigma
    };
  } else {
    // NMW and WBF
    return {
      algorithmType: featureDistillationAlgorithm,
      iouThreshold: featureDistillationIouThreshold,
      skipBoxThreshold: featureDistillationSkipBoxThreshold
    };
  }
}

async function buildImageProcessingRequest(
  jobId: string,
  s3Uri: string,
  imageReadRole: string,
  modelValue: string,
  modelInvokeModeValue: string,
  modelInvocationRole: string,
  selectedOutputs: { label: string; value: string }[],
  tileSizeValue: number,
  tileOverlapValue: number,
  formatValue: string,
  compressionValue: string,
  featureDistillationAlgorithm: string,
  featureDistillationIouThreshold: number,
  featureDistillationSkipBoxThreshold: number,
  featureDistillationSigma: number,
  roiWkt: string,
  featureProperties: string,
  textPrompt: string
): Promise<ImageRequest> {
  const jobName: string = `${JOB_NAME_PREFIX}${jobId}`;
  const accountId = await getAccountId();
  const resultStream = `${KINESIS_RESULTS_STREAM_PREFIX}-${accountId}`;
  const resultBucket = `${S3_RESULTS_BUCKET_PREFIX}-${accountId}`;
  const processor: ImageProcessor = {
    name: modelValue,
    type: modelInvokeModeValue,
    assumedRole: modelInvocationRole
  };
  const outputList: ImageRequestOutput[] = [];
  selectedOutputs.forEach((selectedOutput) => {
    if (selectedOutput.value === "S3") {
      outputList.push({
        type: "S3",
        bucket: resultBucket,
        prefix: `${jobName}/`
      });
    } else if (selectedOutput.value === "Kinesis") {
      outputList.push({
        type: "Kinesis",
        stream: resultStream,
        batchSize: 1000
      });
    }
  });
  logger.info(`Starting ModelRunner image job in ${REGION}`);
  logger.info(`Image: ${s3Uri}`);
  logger.info(`Model: ${modelValue}`);
  logger.info(`Creating request job_id=${jobId}`);
  const imageRequest: ImageRequest = {
    jobId: jobId,
    jobName: jobName,
    imageUrls: [s3Uri],
    imageReadRole: imageReadRole,
    imageProcessor: processor,
    outputs: outputList,
    imageProcessorTileSize: tileSizeValue,
    imageProcessorTileOverlap: tileOverlapValue,
    imageProcessorTileFormat: formatValue,
    imageProcessorTileCompression: compressionValue,
    postProcessing: []
  };

  // Add text prompt as CustomAttributes if provided (for SAM3 model)
  if (textPrompt && textPrompt.trim().length > 0) {
    // URL encode the text prompt to handle spaces and special characters
    const encodedPrompt = encodeURIComponent(textPrompt.trim());
    imageRequest.imageProcessorParameters = {
      CustomAttributes: `text_prompt=${encodedPrompt}`
    };
  }

  if (featureDistillationAlgorithm != "NONE") {
    imageRequest.postProcessing.push({
      step: "FEATURE_DISTILLATION",
      algorithm: build_feature_distillation_obj(
        featureDistillationAlgorithm,
        featureDistillationIouThreshold,
        featureDistillationSkipBoxThreshold,
        featureDistillationSigma
      )
    });
  }
  if (roiWkt.length > 0) {
    imageRequest.regionOfInterest = roiWkt;
  }
  if (featureProperties.length > 0) {
    imageRequest.featureProperties = featureProperties;
  }
  logger.debug("Image request payload", imageRequest);
  return imageRequest;
}
