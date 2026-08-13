import { describe, it, expect, vi } from "vitest";
import { retryWithBackoff } from "@/lib/retry";

// Zero delays so this test runs instantly instead of waiting on real backoff.
const NO_DELAY = [0, 0, 0];

describe("retryWithBackoff", () => {
  it("returns the result on the first try without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn, NO_DELAY);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries after failures and succeeds once the underlying call recovers", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip 1"))
      .mockRejectedValueOnce(new Error("network blip 2"))
      .mockResolvedValueOnce("ok");

    const result = await retryWithBackoff(fn, NO_DELAY);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error once all retries are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent failure"));

    await expect(retryWithBackoff(fn, NO_DELAY)).rejects.toThrow("permanent failure");
    // Initial attempt + one retry per configured delay.
    expect(fn).toHaveBeenCalledTimes(NO_DELAY.length + 1);
  });
});
