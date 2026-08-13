// Generic retry-with-backoff for flaky operations (currently: per-chunk
// recording uploads). Kept dependency-free and pure so it's unit-testable
// without a browser or network.
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
  throw lastError;
}
