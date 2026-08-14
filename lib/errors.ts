// Next.js's Server Action -> Client boundary (the Flight protocol) rejects
// any thrown value that isn't a plain object or one of a small set of
// built-ins: "Only plain objects, and a few built-ins, can be passed to
// Server Actions. Classes or null prototypes are not supported." Every SDK
// this app calls (Supabase's PostgrestError/StorageApiError, fetch-based
// API clients, etc.) throws or returns class-instance errors — re-throwing
// one of those directly from a Server Action crashes with that opaque
// message instead of the real error, and by the time it reaches the user
// there's no way to tell what actually failed.
//
// Rule: never re-throw a caught error object directly. Always route it
// through toPlainError() first. withPlainErrors() wraps an entire Server
// Action as a last-resort safety net, so this holds even for code paths
// that don't yet — but might one day — throw something raw.
export function toPlainError(err: unknown, fallbackMessage = "Something went wrong."): Error {
  if (err instanceof Error) {
    // Re-wrap even genuine Error instances — a subclass (StorageApiError,
    // PostgrestError, etc.) still isn't safe to throw across the boundary;
    // only the plain base Error is.
    return new Error(err.message || fallbackMessage);
  }
  if (typeof err === "string" && err) return new Error(err);
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return new Error((err as { message: string }).message || fallbackMessage);
  }
  return new Error(fallbackMessage);
}

// Next.js's redirect()/notFound() work by throwing a special internal
// object carrying a `digest` — that must propagate completely untouched,
// never rewrapped, or every server action using them (redirect() on the
// success path of signIn/signUp/signOut/etc.) breaks.
function isNextControlFlowError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("digest" in err)) return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && (digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_REDIRECT"));
}

// Wraps a Server Action so ANY value it throws — from code we already
// audited or from a new code path added later — crosses the Server Action
// boundary as a plain Error, never a raw SDK error instance.
export function withPlainErrors<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (isNextControlFlowError(err)) throw err;
      throw toPlainError(err);
    }
  };
}
