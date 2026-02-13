// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Modal for submitting image processing requests to the ModelRunner service.
 */

import React from "react";
import { Color } from "cesium";
import { useContext, useEffect, useState } from "react";
import { CesiumContext } from "resium";
import { v4 as uuidv4 } from "uuid";

import {
  DEFAULT_TILE_COMPRESSION,
  DEFAULT_TILE_FORMAT,
  DEFAULT_TILE_OVERLAP,
  DEFAULT_TILE_SIZE,
  DEFAULT_FEATURE_DISTILLATION_ALGORITHM,
  DEFAULT_FEATURE_DISTILLATION_IOU_THRESHOLD,
  DEFAULT_FEATURE_DISTILLATION_SKIP_BOX_THRESHOLD,
  DEFAULT_FEATURE_DISTILLATION_SIGMA,
  DEFAULT_MODEL_INVOKE_MODE,
  DEFAULT_RESULTS_COLOR_OPTION
} from "@/config";
import { ImageryResource, useResources } from "@/context/ResourceContext";
import { useImageRequestResults } from "@/hooks/useImageRequestResults";
import { useS3Browser } from "@/hooks/useS3Browser";
import type { ImageRequestState } from "@/types";
import { loadImageInCesium, type FeaturePopupCallback } from "@/utils/cesiumHelper";
import { logger } from "@/utils/logger";
import { runModelOnImage } from "@/utils/modelRunnerHelper";
import { getListOfSMEndpoints } from "@/utils/sagemakerHelper";

import {
  DarkAutosuggest,
  DarkFormField,
  DarkInput,
  DarkMultiselect,
  DarkSelect,
  type LabeledOption,
  type LoadingStatus
} from "../ui/FormControls";
import ExpandSection from "../ui/ExpandSection";
import DarkModal from "./DarkModal";

/* ── Color options ───────────────────────────────────────────────────── */
const COLOR_OPTIONS: LabeledOption[] = [
  { label: "Red", value: Color.RED.toCssColorString() },
  { label: "Orange", value: Color.ORANGE.toCssColorString() },
  { label: "Yellow", value: Color.YELLOW.toCssColorString() },
  { label: "Green", value: Color.GREEN.toCssColorString() },
  { label: "Blue", value: Color.BLUE.toCssColorString() },
  { label: "Purple", value: Color.PURPLE.toCssColorString() },
  { label: "Lime", value: Color.LIME.toCssColorString() },
  { label: "Cyan", value: Color.CYAN.toCssColorString() },
  { label: "Fuchsia", value: Color.FUCHSIA.toCssColorString() }
];

/* ── Main Modal Component ───────────────────────────────────────────── */
const NewRequestModal = ({
  showImageRequestModal,
  setShowImageRequestModal,
  imageRequestStatus,
  setImageRequestStatus,
  showCredsExpiredAlert,
  setShowCredsExpiredAlert,
  onFeatureClick
}: {
  showImageRequestModal: boolean;
  setShowImageRequestModal: (show: boolean) => void;
  imageRequestStatus: ImageRequestState;
  setImageRequestStatus: React.Dispatch<React.SetStateAction<ImageRequestState>>;
  showCredsExpiredAlert: boolean;
  setShowCredsExpiredAlert: (show: boolean) => void;
  onFeatureClick?: FeaturePopupCallback;
}) => {
  const cesium = useContext(CesiumContext);
  const { addResource } = useResources();

  // Form state
  const [bucketValue, setBucketValue] = useState("");
  const [imageValue, setImageValue] = useState("");
  const [imageReadRole, setImageReadRole] = useState("");
  const [modelValue, setModelValue] = useState("");
  const [modelStatus, setModelStatus] = useState<LoadingStatus>("pending");
  const [modelInvokeModeValue, setModelInvokeModeValue] = useState(DEFAULT_MODEL_INVOKE_MODE);
  const [modelInvokeRole, setModelInvokeRole] = useState("");
  const [formatValue, setFormatValue] = useState(DEFAULT_TILE_FORMAT);
  const [compressionValue, setCompressionValue] = useState(DEFAULT_TILE_COMPRESSION);
  const [tileSizeValue, setTileSizeValue] = useState(DEFAULT_TILE_SIZE);
  const [tileOverlapValue, setTileOverlapValue] = useState(DEFAULT_TILE_OVERLAP);
  const [featureDistillationAlgorithm, setFeatureDistillationAlgorithm] =
    useState(DEFAULT_FEATURE_DISTILLATION_ALGORITHM);
  const [featureDistillationIouThreshold, setFeatureDistillationIouThreshold] =
    useState(DEFAULT_FEATURE_DISTILLATION_IOU_THRESHOLD);
  const [featureDistillationSkipBoxThreshold, setFeatureDistillationSkipBoxThreshold] =
    useState(DEFAULT_FEATURE_DISTILLATION_SKIP_BOX_THRESHOLD);
  const [featureDistillationSigma, setFeatureDistillationSigma] =
    useState(DEFAULT_FEATURE_DISTILLATION_SIGMA);
  const [iouDisabled, setIouDisabled] = useState(false);
  const [skipBoxDisabled, setSkipBoxDisabled] = useState(true);
  const [sigmaDisabled, setSigmaDisabled] = useState(true);
  const [roiWkt, setRoiWkt] = useState("");
  const [featureProperties, setFeatureProperties] = useState("");
  const [textPrompt, setTextPrompt] = useState("");
  const [resultsColor, setResultsColor] = useState<LabeledOption>(DEFAULT_RESULTS_COLOR_OPTION);
  const [selectedOutputs, setSelectedOutputs] = useState<LabeledOption[]>([
    { label: "S3", value: "S3" },
    { label: "Kinesis", value: "Kinesis" }
  ]);

  const [smModels, setSMModels] = useState<{ value: string }[]>([]);

  // S3 bucket/object browsing via shared hook
  const {
    buckets: s3Buckets,
    bucketStatus,
    objects: s3Objects,
    objectStatus: imageStatus,
    loadObjects: loadS3Objects,
    resetObjects
  } = useS3Browser({
    enabled: showImageRequestModal,
    setShowCredsExpiredAlert
  });

  // Load SM endpoints
  useEffect(() => {
    if (!showImageRequestModal) return;
    (async () => {
      try {
        setModelStatus("loading");
        const res = await getListOfSMEndpoints(setShowCredsExpiredAlert);
        if (res && res.length > 0) {
          setSMModels(res.filter((e): e is string => !!e).map((e) => ({ value: e })));
          setModelStatus("finished");
        } else {
          setModelStatus("error");
        }
      } catch (e) {
        logger.error("Error loading SageMaker endpoints:", e);
        setModelStatus("error");
      }
    })();
  }, [showImageRequestModal, showCredsExpiredAlert]);

  // Auto-load results on success (via extracted hook)
  useImageRequestResults({
    viewer: cesium.viewer ?? undefined,
    imageRequestStatus,
    setImageRequestStatus,
    resultsColor: resultsColor.value,
    setShowCredsExpiredAlert,
    addResource,
    onFeatureClick
  });

  const handleDistillationChange = (val: string) => {
    setFeatureDistillationAlgorithm(val);
    if (val === "NMS") {
      setIouDisabled(false); setSkipBoxDisabled(true); setSigmaDisabled(true);
    } else if (val === "SOFT_NMS") {
      setIouDisabled(false); setSkipBoxDisabled(false); setSigmaDisabled(false);
    } else {
      setIouDisabled(true); setSkipBoxDisabled(true); setSigmaDisabled(true);
    }
  };

  const handleSubmit = async () => {
    const s3Uri = `s3://${bucketValue}/${imageValue}`;
    setShowImageRequestModal(false);
    const jobId = uuidv4();
    const imageId = `${jobId}:${s3Uri}`;

    let retryCount = 0;
    while (!cesium?.viewer && retryCount < 10) {
      await new Promise((r) => setTimeout(r, 100));
      retryCount++;
    }
    if (!cesium?.viewer) { logger.error("Cesium viewer not initialized"); return; }

    await runModelOnImage(
      jobId, s3Uri, imageReadRole, modelValue, modelInvokeModeValue, modelInvokeRole,
      selectedOutputs, tileSizeValue, tileOverlapValue, formatValue, compressionValue,
      featureDistillationAlgorithm, featureDistillationIouThreshold,
      featureDistillationSkipBoxThreshold, featureDistillationSigma,
      roiWkt, featureProperties, textPrompt,
      imageRequestStatus, setImageRequestStatus, setShowCredsExpiredAlert
    );

    const imageryLayer = await loadImageInCesium(
      { viewer: cesium.viewer as any }, bucketValue, imageValue, imageId, setShowCredsExpiredAlert
    );
    if (imageryLayer) {
      const imageName = imageValue.split("/").pop()?.split(".")[0] || "request-image";
      addResource({
        id: uuidv4(), name: imageName, type: "imagery", source: "s3",
        sourceDetail: `${bucketValue}/${imageValue}`, visible: true,
        loadedAt: new Date(), imageryLayer
      } as ImageryResource);
    }
  };

  return (
    <DarkModal
      visible={showImageRequestModal}
      onDismiss={() => setShowImageRequestModal(false)}
      title="Create Image Request"
      subtitle="Submit an image for model processing"
      size="lg"
      icon={
        <div style={{ background: "rgba(251, 146, 60, 0.15)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2v6l4-2" stroke="rgb(251, 146, 60)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="10" r="8" stroke="rgb(251, 146, 60)" strokeWidth="1.5" />
            <path d="M14 14l4 4" stroke="rgb(251, 146, 60)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      }
      footer={
        <>
          <button className="dm-btn dm-btn--ghost" onClick={() => setShowImageRequestModal(false)}>Cancel</button>
          <button className="dm-btn dm-btn--primary" onClick={handleSubmit} disabled={!bucketValue || !imageValue || !modelValue}>
            Submit Request
          </button>
        </>
      }
    >
      <form onSubmit={(e) => e.preventDefault()}>
        {/* Source Image */}
        <div className="dm-field">
          <DarkFormField label="Bucket" description="S3 bucket containing the image to be processed.">
            <DarkAutosuggest
              value={bucketValue}
              onChange={(val) => {
                setBucketValue(val);
                resetObjects();
                if (val) loadS3Objects(val);
              }}
              options={s3Buckets}
              placeholder="Select or type a bucket name"
              status={bucketStatus}
              loadingText="Loading buckets..."
              errorText="Could not load buckets"
              empty="No buckets found"
            />
          </DarkFormField>
        </div>

        <div className="dm-field">
          <DarkFormField label="Image" description="S3 object key (path) to the image file.">
            <DarkAutosuggest
              value={imageValue}
              onChange={setImageValue}
              options={s3Objects}
              placeholder="Select an image to process"
              status={imageStatus}
              loadingText="Loading objects..."
              errorText="Could not load objects"
              empty="No objects found"
            />
          </DarkFormField>
        </div>

        <ExpandSection title="Image Options">
          <div className="dm-field">
            <DarkFormField label="Image Read Role" description="IAM role ARN to read the image from S3.">
              <DarkInput value={imageReadRole} onChange={setImageReadRole} placeholder="arn:aws:iam::..." />
            </DarkFormField>
          </div>
        </ExpandSection>

        {/* Model */}
        <div className="dm-field">
          <DarkFormField label="Model" description="SageMaker model endpoint for image processing.">
            <DarkAutosuggest
              value={modelValue}
              onChange={setModelValue}
              options={smModels}
              placeholder="Select a model endpoint"
              status={modelStatus}
              loadingText="Loading endpoints..."
              errorText="Could not load endpoints"
              empty="No endpoints available"
            />
          </DarkFormField>
        </div>

        <ExpandSection title="Model Options">
          <div className="dm-field">
            <DarkFormField label="Model Invoke Mode" description="How to invoke the model.">
              <DarkAutosuggest
                value={modelInvokeModeValue}
                onChange={setModelInvokeModeValue}
                options={[{ value: "NONE" }, { value: "SM_ENDPOINT" }, { value: "HTTP_ENDPOINT" }]}
                placeholder="Invoke mode"
              />
            </DarkFormField>
          </div>
          <div className="dm-field">
            <DarkFormField label="Model Invocation Role" description="IAM role ARN for invoking the endpoint.">
              <DarkInput value={modelInvokeRole} onChange={setModelInvokeRole} placeholder="arn:aws:iam::..." />
            </DarkFormField>
          </div>
        </ExpandSection>

        {/* Outputs */}
        <div className="dm-field">
          <DarkFormField label="Outputs" description="Where to send processing results.">
            <DarkMultiselect
              selectedOptions={selectedOutputs}
              onChange={setSelectedOutputs}
              options={[
                { label: "S3", value: "S3" },
                { label: "Kinesis", value: "Kinesis" }
              ]}
              placeholder="Choose outputs"
            />
          </DarkFormField>
        </div>

        {/* Tile Options */}
        <ExpandSection title="Tile Options">
          <div className="dm-row">
            <div className="dm-field">
              <DarkFormField label="Tile Size (px)" description="Max tile dimensions.">
                <DarkInput
                  value={tileSizeValue.toString()}
                  onChange={(v) => setTileSizeValue(parseInt(v) || 0)}
                  type="number"
                  inputMode="numeric"
                />
              </DarkFormField>
            </div>
            <div className="dm-field">
              <DarkFormField label="Tile Overlap (px)" description="Overlap between tiles.">
                <DarkInput
                  value={tileOverlapValue.toString()}
                  onChange={(v) => setTileOverlapValue(parseInt(v) || 0)}
                  type="number"
                  inputMode="numeric"
                />
              </DarkFormField>
            </div>
          </div>
          <div className="dm-row">
            <div className="dm-field">
              <DarkFormField label="Tile Format" description="Image format for tiles.">
                <DarkAutosuggest
                  value={formatValue}
                  onChange={setFormatValue}
                  options={[{ value: "GTIFF" }, { value: "NITF" }, { value: "PNG" }, { value: "JPEG" }]}
                  placeholder="Format"
                />
              </DarkFormField>
            </div>
            <div className="dm-field">
              <DarkFormField label="Tile Compression" description="Compression method.">
                <DarkAutosuggest
                  value={compressionValue}
                  onChange={setCompressionValue}
                  options={[{ value: "NONE" }, { value: "JPEG" }, { value: "J2K" }, { value: "LZW" }]}
                  placeholder="Compression"
                />
              </DarkFormField>
            </div>
          </div>
        </ExpandSection>

        {/* Feature Distillation */}
        <ExpandSection title="Feature Distillation">
          <div className="dm-field">
            <DarkFormField label="Algorithm" description="How to handle overlapping features at tile boundaries.">
              <DarkAutosuggest
                value={featureDistillationAlgorithm}
                onChange={handleDistillationChange}
                options={[{ value: "NONE" }, { value: "NMS" }, { value: "SOFT_NMS" }]}
                placeholder="Algorithm"
              />
            </DarkFormField>
          </div>
          <div className="dm-field">
            <DarkFormField label="IOU Threshold" description="Features above this threshold are duplicates.">
              <DarkInput
                value={featureDistillationIouThreshold.toString()}
                onChange={(v) => setFeatureDistillationIouThreshold(parseFloat(v) || 0)}
                type="number"
                inputMode="decimal"
                disabled={iouDisabled}
              />
            </DarkFormField>
          </div>
          <div className="dm-row">
            <div className="dm-field">
              <DarkFormField label="Skip Box Threshold" description="Score threshold for SOFT_NMS.">
                <DarkInput
                  value={featureDistillationSkipBoxThreshold.toString()}
                  onChange={(v) => setFeatureDistillationSkipBoxThreshold(parseFloat(v) || 0)}
                  type="number"
                  inputMode="decimal"
                  disabled={skipBoxDisabled}
                />
              </DarkFormField>
            </div>
            <div className="dm-field">
              <DarkFormField label="Sigma" description="Gaussian decay for SOFT_NMS.">
                <DarkInput
                  value={featureDistillationSigma.toString()}
                  onChange={(v) => setFeatureDistillationSigma(parseFloat(v) || 0)}
                  type="number"
                  inputMode="decimal"
                  disabled={sigmaDisabled}
                />
              </DarkFormField>
            </div>
          </div>
        </ExpandSection>

        {/* Additional Options */}
        <ExpandSection title="Additional Options">
          <div className="dm-field">
            <DarkFormField label="Region of Interest (WKT)" description="WKT geometry to limit processing area.">
              <DarkInput value={roiWkt} onChange={setRoiWkt} placeholder="POLYGON((lon1 lat1, lon2 lat2, ...))" />
            </DarkFormField>
          </div>
          <div className="dm-field">
            <DarkFormField label="Feature Properties (JSON)" description="JSON array of additional properties.">
              <DarkInput value={featureProperties} onChange={setFeatureProperties} placeholder='[{"key": "value"}]' />
            </DarkFormField>
          </div>
          <div className="dm-field">
            <DarkFormField label="Text Prompt" description="Describe what to detect (for text-prompted models).">
              <DarkInput value={textPrompt} onChange={setTextPrompt} placeholder="e.g., cars, buildings, vehicles" />
            </DarkFormField>
          </div>
          <div className="dm-field">
            <DarkFormField label="Results Color" description="Display color for detected features.">
              <DarkSelect
                value={resultsColor}
                onChange={setResultsColor}
                options={COLOR_OPTIONS}
                placeholder="Select color"
                renderOption={(opt) => (
                  <span className="df-color-option">
                    <span className="df-color-swatch" style={{ background: opt.value }} />
                    {opt.label}
                  </span>
                )}
                renderValue={(opt) => (
                  <span className="df-color-option">
                    <span className="df-color-swatch" style={{ background: opt.value }} />
                    {opt.label}
                  </span>
                )}
              />
            </DarkFormField>
          </div>
        </ExpandSection>
      </form>
    </DarkModal>
  );
};

export default NewRequestModal;
