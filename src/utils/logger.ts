// Copyright 2023-2026 Amazon.com, Inc. or its affiliates.

/**
 * Simple structured logger for the application.
 *
 * In development (Vite dev server) all levels are printed to the console.
 * In production builds debug messages are suppressed.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Vite replaces process.env.NODE_ENV at build time; also works in Node/Jest.
const isDev: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const MIN_LEVEL: number = isDev ? LOG_LEVELS.debug : LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= MIN_LEVEL;
}

function formatPrefix(level: LogLevel): string {
  return `[${level.toUpperCase()}]`;
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.log(formatPrefix("debug"), message, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(formatPrefix("info"), message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(formatPrefix("warn"), message, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(formatPrefix("error"), message, ...args);
    }
  }
};
