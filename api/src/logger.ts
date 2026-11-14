/**
 * Minimal structured logger (P1-7).
 *
 * Lambda ships anything written to stdout/stderr to CloudWatch Logs
 * automatically, so "logging" here just means: always emit one JSON line
 * per event, never a bare string, so CloudWatch Logs Insights can filter
 * and aggregate on fields later. Swap this for AWS Lambda Powertools if
 * structured context (cold start, request id, etc.) becomes worth it.
 */

type Level = "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, message: string, fields?: LogFields): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
