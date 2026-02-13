// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Tests for AWS credential error detection logic. */

import { isCredentialError } from "@/config";

describe("isCredentialError", () => {
  it("returns true for known credential error names", () => {
    const knownNames = [
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
    ];

    for (const name of knownNames) {
      expect(isCredentialError({ name })).toBe(true);
    }
  });

  it("returns true for HTTP 401 status codes", () => {
    const err = { $metadata: { httpStatusCode: 401 } };
    expect(isCredentialError(err)).toBe(true);
  });

  it("returns true for HTTP 403 status codes", () => {
    const err = { $metadata: { httpStatusCode: 403 } };
    expect(isCredentialError(err)).toBe(true);
  });

  it("returns true for HTTP 400 status codes", () => {
    const err = { $metadata: { httpStatusCode: 400 } };
    expect(isCredentialError(err)).toBe(true);
  });

  it("returns false for regular errors", () => {
    expect(isCredentialError(new Error("Network timeout"))).toBe(false);
    expect(isCredentialError({ name: "NotFoundError" })).toBe(false);
    expect(isCredentialError(null)).toBe(false);
    expect(isCredentialError(undefined)).toBe(false);
  });

  it("returns false for HTTP 500 status codes", () => {
    const err = { $metadata: { httpStatusCode: 500 } };
    expect(isCredentialError(err)).toBe(false);
  });

  it("returns false for HTTP 200 status codes", () => {
    const err = { $metadata: { httpStatusCode: 200 } };
    expect(isCredentialError(err)).toBe(false);
  });
});
