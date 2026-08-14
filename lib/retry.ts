import { toPlainError } from "@/lib/errors";

// Generic retry-with-backoff for flaky operations (currently: per-chunk
// recording uploads). Kept dependency-free and pure so it's unit-testable
// without a browser or network. Currently only called client-side, but
// re-wrapping the final error here means it stays safe even if a future
// caller runs it inside a Server Action.
export async function retryWithBackoff<T>(fn: () => Promise<T>, delaysMs: number[]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === delaysMs.length) break;
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
  throw toPlainError(lastError, "Operation failed after retries.");
}
