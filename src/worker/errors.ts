import type { NomScanErrorCode } from "@shared/api/nomscan";

export class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly problem: unknown,
    public readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/**
 * Map an upstream HTTP status to the NomScan error code, user-safe message,
 * and the status the *client* should see. The upstream status must not be
 * mirrored blindly: an upstream 401/403 is a Worker-to-indexer credential
 * problem — a gateway failure from the browser's point of view, never a
 * client authorization failure.
 */
export function mapUpstreamStatus(status: number): {
  code: NomScanErrorCode;
  userMessage: string;
  clientStatus: number;
} {
  if (status === 401 || status === 403) {
    return {
      code: "upstream_auth",
      userMessage: "Explorer is temporarily unable to reach indexed data.",
      clientStatus: 502,
    };
  }
  if (status === 404) {
    return { code: "not_found", userMessage: "Not found.", clientStatus: 404 };
  }
  if (status === 429) {
    return {
      code: "rate_limited",
      userMessage: "NoM Scan is receiving too many requests. Please retry shortly.",
      clientStatus: 429,
    };
  }
  if (status === 503) {
    return {
      code: "upstream_unavailable",
      userMessage: "Indexer is syncing or temporarily unavailable.",
      clientStatus: 503,
    };
  }
  if (status >= 500) {
    return { code: "upstream_error", userMessage: "Indexer returned an error.", clientStatus: 502 };
  }
  if (status >= 400) {
    // The Worker validated the inputs, so an upstream 4xx means the proxy built
    // a request the indexer rejects — a gateway-side problem.
    return { code: "bad_request", userMessage: "Bad request.", clientStatus: 502 };
  }
  return { code: "internal", userMessage: "Unexpected error.", clientStatus: 500 };
}
