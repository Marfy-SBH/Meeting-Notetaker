import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { toPlainError, withPlainErrors, categorizeError, parseActionError } from "@/lib/errors";
import { MeetingService } from "@/lib/services/meeting-service";

// Regression tests for the "Only plain objects... Classes... not supported"
// Server Action crash. Next.js's Flight serializer only allows the exact
// base Error class across a Server Action -> Client boundary — not
// subclasses (StorageApiError, PostgrestError, custom SDK error classes),
// which is why re-throwing a caught SDK error directly breaks.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

describe("categorizeError", () => {
  it("buckets a fetch-failure-shaped error as database connectivity", () => {
    const fetchFailed = new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    const categorized = categorizeError(fetchFailed);
    expect(categorized.category).toBe("database");
    expect(categorized.message).toBe("fetch failed");
  });

  it("attributes a fetch failure to storage when the message names a storage operation", () => {
    const rewrapped = new Error('Failed to upload to storage path "x": fetch failed');
    const categorized = categorizeError(rewrapped);
    expect(categorized.category).toBe("storage");
  });

  it("buckets a Postgrest-shaped error (SQLSTATE code) as database", () => {
    const fakePostgrestError = { message: "duplicate key value violates unique constraint", code: "23505", details: null };
    const categorized = categorizeError(fakePostgrestError);
    expect(categorized.category).toBe("database");
    expect(categorized.message).toBe("duplicate key value violates unique constraint");
  });

  it("buckets a JSON-parse error from an HTML maintenance page as a connectivity failure", () => {
    const htmlInsteadOfJson = new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON");
    expect(categorizeError(htmlInsteadOfJson).category).toBe("database");
  });

  it("buckets a generic Error with no recognizable SDK shape as application-level, message preserved as-is", () => {
    const genuine = new Error("Missing chunk 3 of 6 while assembling the recording.");
    const categorized = categorizeError(genuine);
    expect(categorized.category).toBe("application");
    expect(categorized.message).toBe("Missing chunk 3 of 6 while assembling the recording.");
  });

  it("falls back to 'unknown' with the fallback message for unrecognizable thrown values", () => {
    expect(categorizeError(undefined, "fallback")).toMatchObject({ category: "unknown", message: "fallback" });
    expect(categorizeError(42, "fallback")).toMatchObject({ category: "unknown", message: "fallback" });
  });
});

describe("toPlainError", () => {
  it("converts a class instance (subclass of Error) into a plain base Error", () => {
    class FakeSdkError extends Error {
      code = "SOME_SDK_CODE";
      constructor(message: string) {
        super(message);
        this.name = "FakeSdkError";
      }
    }
    const original = new FakeSdkError("something broke");
    const plain = toPlainError(original);

    expect(plain).toBeInstanceOf(Error);
    // The critical property: NOT an instance of the subclass, and its
    // prototype is exactly Error.prototype — this is what Next.js's Flight
    // serializer actually checks, not just "is it an Error".
    expect(plain).not.toBeInstanceOf(FakeSdkError);
    expect(Object.getPrototypeOf(plain)).toBe(Error.prototype);
    // The visible prefix (before the smuggled JSON payload) stays the raw
    // message — so anything reading err.message directly still sees it.
    expect(plain.message.startsWith("something broke")).toBe(true);
    expect(parseActionError(plain).message).toBe("something broke");
  });

  it("handles a plain {message} object (e.g. a Postgrest/Storage error shape) without a message being lost", () => {
    const fakePostgrestError = { message: "duplicate key value violates unique constraint", code: "23505", details: null };
    const plain = toPlainError(fakePostgrestError);
    expect(Object.getPrototypeOf(plain)).toBe(Error.prototype);
    expect(parseActionError(plain).message).toBe("duplicate key value violates unique constraint");
    expect(parseActionError(plain).category).toBe("database");
  });

  it("falls back to a generic message for unrecognizable thrown values", () => {
    expect(parseActionError(toPlainError(undefined, "fallback")).message).toBe("fallback");
    expect(parseActionError(toPlainError(42, "fallback")).message).toBe("fallback");
  });

  it("remaps a Node fetch failure (e.g. an unreachable/paused Supabase project) to the database category", () => {
    const fetchFailed = new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
    const parsed = parseActionError(toPlainError(fetchFailed));
    expect(parsed.category).toBe("database");
    expect(parsed.message).toBe("fetch failed");
  });
});

describe("parseActionError", () => {
  it("treats a plain Error not produced by toPlainError as an application-level message, as-is", () => {
    const parsed = parseActionError(new Error("No active meeting."));
    expect(parsed).toMatchObject({ category: "application", message: "No active meeting." });
  });
});

describe("withPlainErrors", () => {
  it("converts a thrown class instance into a plain Error crossing the wrapped call", async () => {
    class FakeSdkError extends Error {}
    const action = withPlainErrors(async () => {
      throw new FakeSdkError("raw SDK failure");
    });

    await expect(action()).rejects.toThrow("raw SDK failure");
    try {
      await action();
      expect.unreachable();
    } catch (err) {
      expect(Object.getPrototypeOf(err)).toBe(Error.prototype);
    }
  });

  it("lets a Next.js redirect/notFound control-flow error pass through untouched", async () => {
    const redirectError = { digest: "NEXT_REDIRECT;push;/dashboard;307;" };
    const action = withPlainErrors(async () => {
      throw redirectError;
    });

    await expect(action()).rejects.toBe(redirectError);
  });

  it("passes through a successful result unchanged", async () => {
    const action = withPlainErrors(async (n: number) => n * 2);
    await expect(action(21)).resolves.toBe(42);
  });
});

describe("real Supabase error survives the fix (integration)", () => {
  it("MeetingService.listByWorkspace throws a plain Error, not a raw PostgrestError, on a malformed query", async () => {
    const meetingService = new MeetingService(supabase);
    // An invalid UUID shape forces a genuine PostgrestError from the
    // database (invalid input syntax for type uuid), proving this isn't
    // just a hypothetical — this is what would have crashed a Server
    // Action before the fix.
    try {
      await meetingService.listByWorkspace("not-a-valid-uuid");
      expect.unreachable("Expected listByWorkspace to throw on a malformed workspace id");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(Object.getPrototypeOf(err)).toBe(Error.prototype);
    }
  });
});
