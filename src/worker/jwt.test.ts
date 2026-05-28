import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env";

function decodeSegment(seg: string): Record<string, unknown> {
  const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(b64)) as Record<string, unknown>;
}

function envWith(overrides: Partial<Env>): Env {
  return overrides as Env;
}

describe("getNomIndexerJwt", () => {
  // Reset module state between cases — jwt.ts holds a module-level token cache.
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a pre-minted NOM_INDEXER_JWT verbatim", async () => {
    const { getNomIndexerJwt } = await import("./jwt");
    const token = await getNomIndexerJwt(envWith({ NOM_INDEXER_JWT: "pre.minted.jwt" }));
    expect(token).toBe("pre.minted.jwt");
  });

  it("throws when both NOM_INDEXER_JWT and NOM_INDEXER_JWT_SECRET are absent", async () => {
    const { getNomIndexerJwt } = await import("./jwt");
    await expect(getNomIndexerJwt(envWith({}))).rejects.toThrow(/NOM_INDEXER_JWT_SECRET/);
  });

  it("mints a valid HS256 JWT that never embeds the raw secret", async () => {
    const { getNomIndexerJwt } = await import("./jwt");
    const secret = "super-secret-signing-value-do-not-leak";
    const token = await getNomIndexerJwt(
      envWith({ NOM_INDEXER_JWT_SECRET: secret, NOM_INDEXER_JWT_SUBJECT: "pfscan" }),
    );
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(decodeSegment(parts[0]!)).toEqual({ alg: "HS256", typ: "JWT" });
    const payload = decodeSegment(parts[1]!) as { sub: string; iat: number; exp: number };
    expect(payload.sub).toBe("pfscan");
    expect(payload.exp - payload.iat).toBe(300);
    // Security-critical: the HMAC signature is derived from, but never reveals, the secret.
    expect(token).not.toContain(secret);
  });

  it("defaults the subject to 'pfscan'", async () => {
    const { getNomIndexerJwt } = await import("./jwt");
    const token = await getNomIndexerJwt(envWith({ NOM_INDEXER_JWT_SECRET: "another-secret-value-here" }));
    const payload = decodeSegment(token.split(".")[1]!) as { sub: string };
    expect(payload.sub).toBe("pfscan");
  });
});
