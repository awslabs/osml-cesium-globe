// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import Autosuggest from "@cloudscape-design/components/autosuggest";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import { DropdownStatusProps } from "@cloudscape-design/components/internal/components/dropdown-status";
import Modal from "@cloudscape-design/components/modal";
import Multiselect from "@cloudscape-design/components/multiselect";
import Select  from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { Fragment, useContext, useEffect, useState } from "react";
import { CesiumContext, Viewer as ResiumViewer } from "resium";
import { Color } from "cesium";
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
import { loadImageInCesium, loadS3GeoJson } from "@/util/cesiumHelper";
import { runModelOnImage } from "@/util/mrHelper";
import { getListOfS3Buckets, getListOfS3Objects } from "@/util/s3Helper";
import { getListOfSMEndpoints } from "@/util/smHelper";

import CredsExpiredAlert from "../alert/CredsExpiredAlert";

async function loadResults(
    cesium: any,
    outputs: any[],
    jobName: string,
    jobId: string,
    resultsColor: string,
    setShowCredsExpiredAlert: any,
    setImageRequestStatus: any
) {
  let totalFeatures = 0;
  for (const output of outputs) {
    if (output.type === "S3") {
      console.log("Loading results from S3");
      const s3Object = `${jobName}/${jobId}.geojson`
      const featureCount = await loadS3GeoJson(
          cesium,
          output.bucket,
          s3Object,
          resultsColor,
          setShowCredsExpiredAlert
      );
      totalFeatures += featureCount;
    }
  }

  // Update the status message with the feature count
  setImageRequestStatus((prevStatus: { state: string; data: Record<string, any> }) => ({
    ...prevStatus,
    data: {
      ...prevStatus.data,
      featureCount: totalFeatures
    }
  }));
}

const NewRequestModal = ({
                           showImageRequestModal,
                           setShowImageRequestModal,
                           imageRequestStatus,
                           setImageRequestStatus,
                           showCredsExpiredAlert,
                           setShowCredsExpiredAlert
                         }: {
  showImageRequestModal: any;
  setShowImageRequestModal: any;
  imageRequestStatus: any;
  setImageRequestStatus: any;
  showCredsExpiredAlert: any;
  setShowCredsExpiredAlert: any;
}) => {
  const cesium = useContext(CesiumContext);
  const [bucketValue, setBucketValue] = useState("");
  const [bucketStatus, setBucketStatus] =
      useState<DropdownStatusProps.StatusType>("pending");
  const [imageValue, setImageValue] = useState("");
  const [imageStatus, setImageStatus] =
      useState<DropdownStatusProps.StatusType>("pending");
  const [imageReadRole, setImageReadRole] = useState("");
  const [modelValue, setModelValue] = useState("");
  const [modelStatus, setModelStatus] =
      useState<DropdownStatusProps.StatusType>("pending");
  const [modelInvokeModeValue, setModelInvokeModeValue] = useState(DEFAULT_MODEL_INVOKE_MODE);
  const [modelInvokeRole, setModelInvokeRole] = useState("");
  const [formatValue, setFormatValue] = useState(DEFAULT_TILE_FORMAT);
  const [compressionValue, setCompressionValue] = useState(
      DEFAULT_TILE_COMPRESSION
  );
  const [tileSizeValue, setTileSizeValue] = useState(DEFAULT_TILE_SIZE);
  const [tileOverlapValue, setTileOverlapValue] =
      useState(DEFAULT_TILE_OVERLAP);
  const [featureDistillationAlgorithm, setFeatureDistillationAlgorithm] =
      useState(DEFAULT_FEATURE_DISTILLATION_ALGORITHM);
  const [featureDistillationIouThreshold, setFeatureDistillationIouThreshold] =
      useState(DEFAULT_FEATURE_DISTILLATION_IOU_THRESHOLD);
  const [featureDistillationSkipBoxThreshold, setFeatureDistillationSkipBoxThreshold] =
      useState(DEFAULT_FEATURE_DISTILLATION_SKIP_BOX_THRESHOLD);
  const [featureDistillationSigma, setFeatureDistillationSigma] =
      useState(DEFAULT_FEATURE_DISTILLATION_SIGMA);
  const [featureDistillationIouThresholdDisabled, setFeatureDistillationIouThresholdDisabled] =
      useState(false);
  const [featureDistillationSkipBoxThresholdDisabled, setFeatureDistillationSkipBoxThresholdDisabled] =
      useState(true);
  const [featureDistillationSigmaDisabled, setFeatureDistillationSigmaDisabled] =
      useState(true);
  const [roiWkt, setRoiWkt] = useState("");
  const [featureProperties, setFeatureProperties] = useState("");
  const [resultsColor, setResultsColor] =
      useState(DEFAULT_RESULTS_COLOR_OPTION);


  const [selectedOutputs, setSelectedOutputs] = useState([
    {
      label: "S3",
      value: "S3"
    },
    {
      label: "Kinesis",
      value: "Kinesis"
    }
  ]);

  const [s3Buckets, setS3Buckets] = useState<any[]>([]);
  const [smModels, setSMModels] = useState<any[]>([]);
  const [s3BucketDataLoaded, setS3BucketDataLoaded] = useState(false);
  const [s3Objects, setS3Objects] = useState<any[]>([]);
  const [s3ObjectsDataLoaded, setS3ObjectsDataLoaded] = useState(false);

  let bucketList: any[] = [];
  useEffect(() => {
    (async () => {
      setBucketStatus("loading");
      const res: any = await getListOfS3Buckets(setShowCredsExpiredAlert);
      if (res !== undefined) {
        for (let i = 0; i < res.length; i++) {
          bucketList.push({ value: res[i]["Name"] });
        }
        setS3Buckets(bucketList);
        setS3BucketDataLoaded(true);
        setBucketStatus("finished");
        bucketList = [];
      } else {
        setS3BucketDataLoaded(false);
        setBucketStatus("error");
        bucketList = [];
      }
    })();
  }, [showCredsExpiredAlert]);

  let smModelsList: any[] = [];
  useEffect(() => {
    (async () => {
      setModelStatus("loading");
      const res: any = await getListOfSMEndpoints(setShowCredsExpiredAlert);
      if (res !== undefined) {
        for (let i = 0; i < res.length; i++) {
          smModelsList.push({ value: res[i] });
        }
        setSMModels(smModelsList);
        setModelStatus("finished");
        bucketList = [];
      } else {
        setModelStatus("error");
        smModelsList = [];
      }
    })();
  }, [showCredsExpiredAlert]);

  const loadS3Objects = async (bucket: string) => {
    setImageStatus("loading");
    let s3ObjectsList: any[] = [];
    const res: any = await getListOfS3Objects(bucket, setShowCredsExpiredAlert);
    if (res !== undefined) {
      for (let i = 0; i < res.length; i++) {
        s3ObjectsList.push({ value: res[i]["Key"] });
      }
      setS3Objects(s3ObjectsList);
      setS3ObjectsDataLoaded(true);
      setImageStatus("finished");
      s3ObjectsList = [];
    } else {
      setS3ObjectsDataLoaded(false);
      setImageStatus("error");
      s3ObjectsList = [];
    }
  };

  useEffect(() => {
    const getData = async (
        cesium: any,
        outputs: any,
        jobName: string,
        jobId: string
    ) => {
      // Only load results if we haven't already loaded them
      if (!imageRequestStatus.data.featureCount) {
        await loadResults(
            cesium,
            outputs,
            jobName,
            jobId,
            resultsColor.value,
            setShowCredsExpiredAlert,
            setImageRequestStatus
        );
      }
    };
    if (imageRequestStatus.state == "success") {
      getData(
          cesium,
          imageRequestStatus.data.outputs,
          imageRequestStatus.data.jobName,
          imageRequestStatus.data.jobId
      );
    }
  }, [imageRequestStatus.state, showCredsExpiredAlert]);

  return (
      <div>
        <div>
          <Modal
              onDismiss={() => setShowImageRequestModal(false)}
              visible={showImageRequestModal}
              closeAriaLabel="Close modal"
              header={<Fragment>Create Image Request</Fragment>}
          >
            {showCredsExpiredAlert && (
                <CredsExpiredAlert
                    setShowCredsExpiredAlert={setShowCredsExpiredAlert}
                />
            )}
            <form onSubmit={(e) => e.preventDefault()}>
              <Form
                  actions={
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button
                          onClick={() => setShowImageRequestModal(false)}
                          formAction="none"
                          variant="link"
                      >
                        Cancel
                      </Button>
                      <Button
                          onClick={async () => {
                            const s3Uri = `s3://${bucketValue}/${imageValue}`;
                            setShowImageRequestModal(false);
                            const jobId: string = uuidv4();
                            const imageId: string = `${jobId}:${s3Uri}`;

                            // Wait for viewer to be initialized
                            let retryCount = 0;
                            const maxRetries = 10;
                            while (!cesium?.viewer && retryCount < maxRetries) {
                              await new Promise(resolve => setTimeout(resolve, 100));
                              retryCount++;
                            }

                            if (!cesium?.viewer) {
                              console.error('Cesium viewer is not initialized after waiting');
                              return;
                            }

                            await runModelOnImage(
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
                                imageRequestStatus,
                                setImageRequestStatus,
                                setShowCredsExpiredAlert
                            );

                            await loadImageInCesium(
                                { viewer: cesium.viewer as any },
                                bucketValue,
                                imageValue,
                                imageId,
                                setShowCredsExpiredAlert
                            );
                          }}
                          variant="primary"
                      >
                        Submit
                      </Button>
                    </SpaceBetween>
                  }
              >
                <Container>
                  <SpaceBetween direction="vertical" size="l">
                    <FormField label="Bucket">
                      <Autosuggest
                          onChange={({ detail }) => {
                            setBucketValue(detail.value);
                            setS3Objects([]);
                            setImageStatus("pending");
                            if (detail.value) {
                              loadS3Objects(detail.value);
                            }
                          }}
                          value={bucketValue}
                          options={s3Buckets}
                          enteredTextLabel={(value) => `Use: "${value}"`}
                          ariaLabel="Bucket Selection"
                          placeholder="Bucket"
                          empty="No buckets loaded"
                          loadingText="Loading buckets"
                          errorText="Could not load buckets"
                          statusType={bucketStatus}
                      />
                    </FormField>
                    <FormField label="Image">
                      <Autosuggest
                          onChange={({ detail }) => setImageValue(detail.value)}
                          value={imageValue}
                          options={s3Objects}
                          enteredTextLabel={(value) => `Use: "${value}"`}
                          ariaLabel="Image Selection"
                          placeholder="Image to process"
                          empty="No S3 objects loaded"
                          loadingText="Loading S3 objects"
                          errorText="Could not load S3 objects"
                          statusType={imageStatus}
                      />
                    </FormField>
                    <ExpandableSection headerText="Image Options">
                      <FormField label="Image Read Role">
                        <Input
                            onChange={({detail}) => setImageReadRole(detail.value)}
                            value={imageReadRole}
                        />
                      </FormField>
                    </ExpandableSection>
                    <FormField label="Model">
                      <Autosuggest
                          onChange={({ detail }) => setModelValue(detail.value)}
                          value={modelValue}
                          options={smModels}
                          statusType={modelStatus}
                          enteredTextLabel={(value) => `Use: "${value}"`}
                          ariaLabel="Model Selection"
                          placeholder="Model name"
                          empty=""
                      />
                    </FormField>
                    <ExpandableSection headerText="Model Options">
                      <FormField label="Model Invoke Mode">
                        <Autosuggest
                            onChange={({detail}) => setModelInvokeModeValue(detail.value)}
                            value={modelInvokeModeValue}
                            options={[
                              {value: "NONE"},
                              {value: "SM_ENDPOINT"},
                              {value: "HTTP_ENDPOINT"},
                            ]}
                            enteredTextLabel={value => `Use: "${value}"`}
                            ariaLabel="Model Invoke Mode Selection"
                            placeholder="Model Invoke Mode"
                            empty=""
                        />
                      </FormField>
                      <FormField label="Model Invocation Role">
                        <Input
                            onChange={({detail}) => setModelInvokeRole(detail.value)}
                            value={modelInvokeRole}
                        />
                      </FormField>
                    </ExpandableSection>
                    <FormField label="Outputs">
                      <Multiselect
                          selectedOptions={selectedOutputs}
                          onChange={({ detail }) => {
                            if (
                                detail.selectedOptions &&
                                Array.isArray(detail.selectedOptions)
                            ) {
                              setSelectedOutputs([...detail.selectedOptions]);
                            } else {
                              setSelectedOutputs([]);
                            }
                          }}
                          deselectAriaLabel={(e) => `Remove ${e.label}`}
                          options={[
                            {
                              label: "S3",
                              value: "S3"
                            },
                            {
                              label: "Kinesis",
                              value: "Kinesis"
                            }
                          ]}
                          placeholder="Choose output"
                          selectedAriaLabel="Selected"
                      />
                    </FormField>
                    <ExpandableSection headerText="Tile Options">
                      <FormField label="Tile Size (px)">
                        <Input
                            onChange={({detail}) => setTileSizeValue(parseInt(detail.value))}
                            value={tileSizeValue.toString()}
                            inputMode="numeric"
                            type="number"
                        />
                      </FormField>
                      <FormField label="Tile Overlap (px)">
                        <Input
                            onChange={({detail}) => setTileOverlapValue(parseInt(detail.value))}
                            value={tileOverlapValue.toString()}
                            inputMode="numeric"
                            type="number"
                        />
                      </FormField>
                      <FormField label="Tile Format">
                        <Autosuggest
                            onChange={({ detail }) => setFormatValue(detail.value)}
                            value={formatValue}
                            options={[
                              { value: "GTIFF" },
                              { value: "NITF" },
                              { value: "PNG" },
                              { value: "JPEG" }
                            ]}
                            enteredTextLabel={(value) => `Use: "${value}"`}
                            ariaLabel="Tile Format Selection"
                            placeholder="Tile format"
                            empty=""
                        />
                      </FormField>
                      <FormField label="Tile Compression">
                        <Autosuggest
                            onChange={({ detail }) =>
                                setCompressionValue(detail.value)
                            }
                            value={compressionValue}
                            options={[
                              { value: "NONE" },
                              { value: "JPEG" },
                              { value: "J2K" },
                              { value: "LZW" }
                            ]}
                            enteredTextLabel={(value) => `Use: "${value}"`}
                            ariaLabel="Tile Compression Selection"
                            placeholder="Tile compression"
                            empty=""
                        />
                      </FormField>
                    </ExpandableSection>
                    <ExpandableSection headerText="Feature Distillation Options">
                      <FormField label="Feature Distillation Algorithm">
                        <Autosuggest
                            onChange={({detail}) => {
                              setFeatureDistillationAlgorithm(detail.value);
                              if (detail.value === "NMS") {
                                setFeatureDistillationIouThresholdDisabled(false);
                                setFeatureDistillationSkipBoxThresholdDisabled(true);
                                setFeatureDistillationSigmaDisabled(true);
                              } else if (detail.value === "SOFT_NMS") {
                                setFeatureDistillationIouThresholdDisabled(false);
                                setFeatureDistillationSkipBoxThresholdDisabled(false);
                                setFeatureDistillationSigmaDisabled(false);
                              } else { // NONE or invalid
                                setFeatureDistillationIouThresholdDisabled(true);
                                setFeatureDistillationSkipBoxThresholdDisabled(true);
                                setFeatureDistillationSigmaDisabled(true);
                              }
                            }}
                            value={featureDistillationAlgorithm}
                            options={[
                              {value: "NONE"},
                              {value: "NMS"},
                              {value: "SOFT_NMS"},
                            ]}
                            enteredTextLabel={value => `Use: "${value}"`}
                            ariaLabel="Feature Distillation Algorithm"
                            placeholder="Algorithm"
                            empty=""
                        />
                      </FormField>
                      <FormField label="Feature Distillation IOU Threshold">
                        <Input
                            onChange={({detail}) => setFeatureDistillationIouThreshold(parseFloat(detail.value))}
                            value={featureDistillationIouThreshold.toString()}
                            disabled={featureDistillationIouThresholdDisabled}
                            inputMode="decimal"
                            type="number"
                        />
                      </FormField>
                      <FormField label="Feature Distillation Skip Box Threshold">
                        <Input
                            onChange={({detail}) => setFeatureDistillationSkipBoxThreshold(parseFloat(detail.value))}
                            value={featureDistillationSkipBoxThreshold.toString()}
                            disabled={featureDistillationSkipBoxThresholdDisabled}
                            inputMode="decimal"
                            type="number"
                        />
                      </FormField>
                      <FormField label="Feature Distillation Sigma">
                        <Input
                            onChange={({detail}) => setFeatureDistillationSigma(parseFloat(detail.value))}
                            value={featureDistillationSigma.toString()}
                            disabled={featureDistillationSigmaDisabled}
                            inputMode="decimal"
                            type="number"
                        />
                      </FormField>
                    </ExpandableSection>
                    <ExpandableSection headerText="Additional Options">
                      <FormField label="Region of Interest (WKT)">
                        <Input
                            onChange={({detail}) => setRoiWkt(detail.value)}
                            value={roiWkt}
                        />
                      </FormField>
                      <FormField label="Feature Properties (JSON)">
                        <Input
                            onChange={({detail}) => setFeatureProperties(detail.value)}
                            value={featureProperties}
                        />
                      </FormField>
                      <FormField label="Results Color">
                        <Select
                            selectedOption={resultsColor}
                            onChange={({ detail }) =>
                                setResultsColor({ label: detail.selectedOption.label!, value: detail.selectedOption.value! })
                            }
                            options={[
                              { label: "Red", value: Color.RED.toCssColorString() },
                              { label: "Orange", value: Color.ORANGE.toCssColorString() },
                              { label: "Yellow", value: Color.YELLOW.toCssColorString() },
                              { label: "Green", value: Color.GREEN.toCssColorString() },
                              { label: "Blue", value: Color.BLUE.toCssColorString() },
                              { label: "Purple", value: Color.PURPLE.toCssColorString() },
                              { label: "Lime", value: Color.LIME.toCssColorString() },
                              { label: "Cyan", value: Color.CYAN.toCssColorString() },
                              { label: "Fuchsia", value: Color.FUCHSIA.toCssColorString() },
                            ]}
                            ariaLabel="Results Color"
                            placeholder="Select Color"
                            empty=""
                        />
                      </FormField>
                    </ExpandableSection>
                  </SpaceBetween>
                </Container>
              </Form>
            </form>
          </Modal>
        </div>
      </div>
  );
};

export default NewRequestModal;
