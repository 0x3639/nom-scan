export interface Env {
  /** Base URL of the upstream nom-indexer-go (e.g. http://localhost:8080 or https://prod-indexer). */
  NOM_INDEXER_BASE_URL: string;

  /**
   * HMAC-SHA256 secret used to mint short-lived JWTs for nom-indexer-go.
   * Mutually exclusive with NOM_INDEXER_JWT; if both are set, NOM_INDEXER_JWT wins.
   */
  NOM_INDEXER_JWT_SECRET?: string;

  /** Pre-minted long-lived JWT. Use only when minting is not possible. */
  NOM_INDEXER_JWT?: string;

  /** Subject claim placed in minted JWTs. Defaults to "pfscan". */
  NOM_INDEXER_JWT_SUBJECT?: string;

  /** Cloudflare static-assets binding (declared in wrangler.jsonc). */
  ASSETS: Fetcher;

  /**
   * Deployment environment. "production" applies a strict CSP that disallows
   * inline scripts. "local" relaxes CSP so Vite's React Fast Refresh preamble
   * (an inline script) can run during dev.
   */
  PFSCAN_ENV?: "local" | "production";
}
