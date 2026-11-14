/**
 * Minimal browser error reporter (P1-7).
 *
 * Right now this only gives errors a consistent, structured shape in the
 * console so they are easy to spot and grep for. Swap `report` for a real
 * call to an error-tracking service (the plan suggests Sentry) once one is
 * wired up -- nothing else in the app needs to change.
 */

interface ReportedError {
  message: string;
  stack?: string;
  time: string;
  source: "window.onerror" | "unhandledrejection";
}

function report(error: ReportedError): void {
  console.error("[live-slides:error]", JSON.stringify(error));
}

export function installErrorReporter(): void {
  window.addEventListener("error", (event) => {
    report({
      message: event.message,
      stack: event.error?.stack,
      time: new Date().toISOString(),
      source: "window.onerror",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    report({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      time: new Date().toISOString(),
      source: "unhandledrejection",
    });
  });
}
