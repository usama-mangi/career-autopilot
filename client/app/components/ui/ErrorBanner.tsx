import { cn } from "~/lib/utils";
import { AI_UNAVAILABLE_MESSAGE, describeError, isAiUnavailableError, type ApiError } from "~/lib/api";
import type { Toast } from "./Toast";

export interface ErrorBannerProps {
  /** The caught error (or a plain message string). */
  error: unknown;
  /** Fallback when `error` carries no message. */
  fallback?: string;
  /** Dismisses the banner. */
  onDismiss?: () => void;
  /**
   * Called by the built-in Retry button on transient failures. Without it,
   * transient errors render the same copy but no retry affordance.
   */
  onRetry?: () => void;
  className?: string;
}

/**
 * Message patterns that indicate a transient failure when only the message
 * string is available (routes store `err.message` in state, not the error
 * object). Covers the api.ts timeout copy, HTTP 429/5xx default messages,
 * and the browser's own network failures. 4xx contract messages ("...not
 * found", validation text, "Unauthorized") intentionally do not match.
 */
const TRANSIENT_MESSAGE_PATTERN =
  /\btimeout\b|temporarily|too many requests|rate limit|service unavailable|bad gateway|internal server error|failed to fetch|network (error|request failed)/i;

/** True when a failure message looks transient even without the ApiError object. */
export function isTransientErrorMessage(message: string): boolean {
  if (message === AI_UNAVAILABLE_MESSAGE) return true;
  return TRANSIENT_MESSAGE_PATTERN.test(message);
}

/**
 * Inline error banner that classifies failures by the server's error contract:
 *
 * - Transient (502 AI outages, rate limits, timeouts, 5xx): amber styling with
 *   a wait-and-retry message plus an optional Retry action.
 * - Permanent (400/404/401 validation or not-found errors): red styling with
 *   the server's actionable message — no retry affordance.
 *
 * Classification works two ways: status-based when a real ApiError object is
 * passed, and message-pattern-based (AI_UNAVAILABLE_MESSAGE or the transient
 * patterns above) when routes pass the stored message string from `error`
 * state.
 */
export function ErrorBanner({
  error,
  fallback = "Something went wrong",
  onDismiss,
  onRetry,
  className,
}: ErrorBannerProps) {
  const message = describeError(error, fallback);
  const isTransient =
    isAiUnavailableError(error) || isTransientErrorMessage(message);

  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm",
        isTransient
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-red-200 bg-red-50 text-red-700",
        className,
      )}
    >
      <svg
        className={cn("mt-0.5 h-4 w-4 flex-shrink-0", isTransient ? "text-amber-500" : "text-red-500")}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={
            isTransient
              ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          }
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {isTransient && (
          <p className="mt-0.5 text-xs opacity-80">
            This usually resolves in a moment — no data was lost.
          </p>
        )}
        {isTransient && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Retry
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Options for {@link reportError}: toast + optional inline banner state. */
interface ReportErrorOptions {
  title: string;
  /** The route's `error: toastError` from useToastHelpers (passed in — this is a plain function, not a hook). */
  toastError: (title: string, message?: string, options?: Partial<Toast>) => void;
  /** Set to render the inline banner via `setError`. */
  setError?: (message: string) => void;
  /** Extra Retry button on the toast for transient failures. */
  retry?: () => void;
}

/**
 * Uniform error handling for route catch blocks: toasts always show the
 * server's message; transient failures (AI outages, rate limits) get a
 * "temporarily unavailable" title and an optional Retry action; `setError`
 * mirrors the message into the inline banner. Returns `true` when the
 * failure is transient, so callers can branch if needed.
 */
export function reportError(err: unknown, { title, toastError, setError, retry }: ReportErrorOptions): boolean {
  const message = describeError(err, fallbackFor(title));
  const transient = isAiUnavailableError(err) || isTransientErrorMessage(message);
  setError?.(message);
  toastError(
    transient ? `${title} — service temporarily unavailable` : title,
    message,
    retry && transient ? { action: { label: "Retry", onClick: retry } } : undefined,
  );
  return transient;
}

function fallbackFor(title: string): string {
  if (/generat/i.test(title)) return "Failed to generate";
  if (/analy/i.test(title)) return "Failed to analyze";
  return "Something went wrong. Please try again.";
}
