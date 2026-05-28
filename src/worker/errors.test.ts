import { describe, expect, it } from "vitest";
import { mapUpstreamStatus } from "./errors";

describe("mapUpstreamStatus", () => {
  it("maps known upstream statuses to error codes", () => {
    expect(mapUpstreamStatus(401).code).toBe("upstream_auth");
    expect(mapUpstreamStatus(403).code).toBe("upstream_auth");
    expect(mapUpstreamStatus(404).code).toBe("not_found");
    expect(mapUpstreamStatus(429).code).toBe("rate_limited");
    expect(mapUpstreamStatus(500).code).toBe("upstream_error");
    expect(mapUpstreamStatus(502).code).toBe("upstream_error");
    expect(mapUpstreamStatus(400).code).toBe("bad_request");
    expect(mapUpstreamStatus(422).code).toBe("bad_request");
  });

  it("special-cases 503 ahead of the generic >=500 branch", () => {
    expect(mapUpstreamStatus(503).code).toBe("upstream_unavailable");
  });

  it("falls back to internal for unexpected statuses", () => {
    expect(mapUpstreamStatus(302).code).toBe("internal");
    expect(mapUpstreamStatus(200).code).toBe("internal");
  });
});
