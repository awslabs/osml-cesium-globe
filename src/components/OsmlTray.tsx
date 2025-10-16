// Copyright 2023-2025 Amazon.com, Inc. or its affiliates.

import React from "react";

import OsmlMenu from "@/components/OsmlMenu";

interface OsmlTrayProps {
  imageRequestStatus: {
    state: string;
    data: Record<string, any>;
  };
  setImageRequestStatus: (status: { state: string; data: Record<string, any> }) => void;
}

const OsmlTray = ({ imageRequestStatus, setImageRequestStatus }: OsmlTrayProps) => {
  return (
    <div className="osml-tray">
      <OsmlMenu
        imageRequestStatus={imageRequestStatus}
        setImageRequestStatus={setImageRequestStatus}
      />
    </div>
  );
};

export default OsmlTray;
