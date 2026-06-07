import type { Env } from "./env";

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = encoder.encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface CachedJwt {
  token: string;
  expiresAt: number;
}

let cached: CachedJwt | null = null;
const TTL_SECONDS = 300;
const REFRESH_BEFORE_EXPIRY_SECONDS = 30;

async function mintHs256(secret: string, subject: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { sub: subject, iat: now, exp: now + ttlSeconds };
  const headerSegment = base64url(JSON.stringify(header));
  const payloadSegment = base64url(JSON.stringify(payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * A pre-minted JWT: "eyJ"-prefixed header + three base64url segments. Used to tell
 * a finished token apart from an HMAC signing secret (which has no such shape),
 * so a token configured in either env var is forwarded verbatim rather than being
 * mistakenly used as a signing key.
 */
function looksLikeJwt(value: string): boolean {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Returns a Bearer-ready JWT string for nom-indexer-go.
 * Prefers a pre-minted env.NOM_INDEXER_JWT, falling back to env.NOM_INDEXER_JWT_SECRET.
 * If that "secret" is itself a pre-minted JWT it is forwarded verbatim; otherwise it
 * is treated as an HMAC key and used to sign a fresh short-lived JWT (cached in-isolate).
 */
export async function getNomIndexerJwt(env: Env): Promise<string> {
  if (env.NOM_INDEXER_JWT) return env.NOM_INDEXER_JWT;
  const secret = env.NOM_INDEXER_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Worker is missing NOM_INDEXER_JWT and NOM_INDEXER_JWT_SECRET — cannot authenticate to upstream.",
    );
  }
  // A finished token can't sign anything — forward it as-is. This makes a token
  // configured under NOM_INDEXER_JWT_SECRET work the same as NOM_INDEXER_JWT.
  if (looksLikeJwt(secret)) return secret;

  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - REFRESH_BEFORE_EXPIRY_SECONDS > now) {
    return cached.token;
  }
  const subject = env.NOM_INDEXER_JWT_SUBJECT ?? "nomscan";
  const token = await mintHs256(secret, subject, TTL_SECONDS);
  cached = { token, expiresAt: now + TTL_SECONDS };
  return token;
}
