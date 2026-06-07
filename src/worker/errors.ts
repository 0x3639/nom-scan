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

export function mapUpstreamStatus(status: number): { code: NomScanErrorCode; userMessage: string } {
  if (status === 401 || status === 403) {
    return {
      code: "upstream_auth",
      userMessage: "Explorer is temporarily unable to reach indexed data.",
    };
  }
  if (status === 404) {
    return { code: "not_found", userMessage: "Not found." };
  }
  if (status === 429) {
    return {
      code: "rate_limited",
      userMessage: "NoM Scan is receiving too many requests. Please retry shortly.",
    };
  }
  if (status === 503) {
    return {
      code: "upstream_unavailable",
      userMessage: "Indexer is syncing or temporarily unavailable.",
    };
  }
  if (status >= 500) {
    return { code: "upstream_error", userMessage: "Indexer returned an error." };
  }
  if (status >= 400) {
    return { code: "bad_request", userMessage: "Bad request." };
  }
  return { code: "internal", userMessage: "Unexpected error." };
}
