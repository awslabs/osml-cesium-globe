// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/** Tests for the structured logger utility. */

import { logger } from "@/utils/logger";

describe("logger", () => {
  let consoleSpy: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, "log").mockImplementation(),
      warn: jest.spyOn(console, "warn").mockImplementation(),
      error: jest.spyOn(console, "error").mockImplementation()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("logger.info calls console.log with prefix", () => {
    logger.info("test message");
    expect(consoleSpy.log).toHaveBeenCalledWith("[INFO]", "test message");
  });

  it("logger.warn calls console.warn with prefix", () => {
    logger.warn("warning message");
    expect(consoleSpy.warn).toHaveBeenCalledWith("[WARN]", "warning message");
  });

  it("logger.error calls console.error with prefix", () => {
    logger.error("error message");
    expect(consoleSpy.error).toHaveBeenCalledWith("[ERROR]", "error message");
  });

  it("passes extra arguments through", () => {
    const extra = { key: "value" };
    logger.info("message", extra);
    expect(consoleSpy.log).toHaveBeenCalledWith("[INFO]", "message", extra);
  });

  it("logger.error passes Error objects", () => {
    const err = new Error("test error");
    logger.error("something failed", err);
    expect(consoleSpy.error).toHaveBeenCalledWith("[ERROR]", "something failed", err);
  });
});
