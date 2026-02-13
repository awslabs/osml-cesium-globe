// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

import { handleAwsError } from "@/hooks/useS3Browser";

describe("handleAwsError", () => {
  it("calls setShowCredsExpiredAlert(true) for credential errors", () => {
    const setAlert = jest.fn();
    handleAwsError({ name: "ExpiredToken" }, setAlert);
    expect(setAlert).toHaveBeenCalledWith(true);
  });

  it("calls setShowCredsExpiredAlert(true) for HTTP 403", () => {
    const setAlert = jest.fn();
    handleAwsError({ $metadata: { httpStatusCode: 403 } }, setAlert);
    expect(setAlert).toHaveBeenCalledWith(true);
  });

  it("does not call setShowCredsExpiredAlert for non-credential errors", () => {
    const setAlert = jest.fn();
    handleAwsError(new Error("Network timeout"), setAlert);
    expect(setAlert).not.toHaveBeenCalled();
  });

  it("handles null error without throwing", () => {
    const setAlert = jest.fn();
    expect(() => handleAwsError(null, setAlert)).not.toThrow();
    expect(setAlert).not.toHaveBeenCalled();
  });

  it("handles undefined error without throwing", () => {
    const setAlert = jest.fn();
    expect(() => handleAwsError(undefined, setAlert)).not.toThrow();
    expect(setAlert).not.toHaveBeenCalled();
  });
});
