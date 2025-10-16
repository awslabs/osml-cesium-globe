// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import { Autosuggest, SpaceBetween } from "@cloudscape-design/components";
import FormField from "@cloudscape-design/components/form-field";
import { DropdownStatusProps } from "@cloudscape-design/components/internal/components/dropdown-status";
import { useEffect, useState } from "react";

import { getListOfS3Buckets, getListOfS3Objects } from "@/util/s3Helper";

const S3ImageSelector = ({
  s3Object,
  setS3Object,
  s3Bucket,
  setS3Bucket,
  setShowCredsExpiredAlert,
  showCredsExpiredAlert
}: {
  s3Object: any;
  setS3Object: any;
  s3Bucket: any;
  setS3Bucket: any;
  setShowCredsExpiredAlert: any;
  showCredsExpiredAlert: any;
}) => {
  const [bucketStatus, setBucketStatus] =
    useState<DropdownStatusProps.StatusType>("pending");
  const [imageStatus, setImageStatus] =
    useState<DropdownStatusProps.StatusType>("pending");

  const [s3Buckets, setS3Buckets] = useState<any[]>([]);
  const [s3BucketDataLoaded, setS3BucketDataLoaded] = useState(false);
  const [s3Objects, setS3Objects] = useState<any[]>([]);
  const [s3ObjectsDataLoaded, setS3ObjectsDataLoaded] = useState(false);

  // Check if file is an image based on extension
  function isImageFile(filename: string): boolean {
    const imageExtensions = ['.tif', '.tiff', '.png', '.jpg', '.jpeg', '.bmp', '.gif', '.ntf'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

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

  const loadS3Objects = async (bucket: string) => {
    setImageStatus("loading");
    let s3ObjectsList: any[] = [];
    const res: any = await getListOfS3Objects(bucket, setShowCredsExpiredAlert);
    if (res !== undefined) {
      for (let i = 0; i < res.length; i++) {
        const objectName = res[i]["Key"];
        if (isImageFile(objectName)) {
          s3ObjectsList.push({ value: objectName });
        }
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

  return (
    <SpaceBetween direction="vertical" size="l">
      <FormField label="Bucket">
        <Autosuggest
          onChange={({ detail }) => {
            setS3Bucket(detail.value);
            setS3Objects([]);
            setImageStatus("pending");
            if (detail.value) {
              loadS3Objects(detail.value);
            }
          }}
          value={s3Bucket}
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
          onChange={({ detail }) => setS3Object(detail.value)}
          value={s3Object}
          options={s3Objects}
          enteredTextLabel={(value) => `Use: "${value}"`}
          ariaLabel="Image Selection"
          placeholder="Image to load"
          empty="No image objects loaded"
          loadingText="Loading image objects"
          errorText="Could not load image objects"
          statusType={imageStatus}
        />
      </FormField>
    </SpaceBetween>
  );
};

export default S3ImageSelector;
