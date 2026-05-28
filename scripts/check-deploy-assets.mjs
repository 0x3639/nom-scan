#!/usr/bin/env node
/**
 * Pre-deploy guard: fail loudly if any secret or Worker artifact would be
 * published as a public static asset.
 *
 * Background: `wrangler.jsonc` serves `assets.directory` to the public internet.
 * The build copies the developer's `.dev.vars` (which holds NOM_INDEXER_JWT_SECRET)
 * into the Worker output dir. If the served directory ever includes that file,
 * the upstream JWT signing secret leaks. This guard scans the directory that
 * WILL be served and refuses to deploy if anything dangerous is present.
 *
 * Wired into `deploy:production` so it runs after `vite build`, before `wrangler deploy`.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// The directory wrangler.jsonc serves as static assets. Keep in sync with
// the "assets.directory" value there.
const SERVED_DIR = "./dist/client/client";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Secret/marker patterns that must never appear in a served asset.
const patterns = [
  { name: "NOM_INDEXER_JWT_SECRET", re: /NOM_INDEXER_JWT_SECRET/ },
  { name: "minted/raw bearer JWT", re: /Bearer\s+eyJ/ },
  { name: "NOM_INDEXER_JWT var", re: /NOM_INDEXER_JWT\b/ },
];

// If a local .dev.vars exists, also scan for its literal secret value(s).
if (existsSync(".dev.vars")) {
  const text = readFileSync(".dev.vars", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (val.length >= 8) {
      patterns.push({ name: `literal value of ${key}`, re: new RegExp(escapeRegExp(val)) });
    }
  }
}

// Filenames that must never be served even if they contain no secret today.
const forbiddenNames = [/^\.dev\.vars$/, /^wrangler\.json$/, /^wrangler\.jsonc$/];

const leaks = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // dir missing -> nothing built yet; the build step handles that
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (forbiddenNames.some((re) => re.test(name))) {
      leaks.push(`forbidden file served as public asset: ${full}`);
      continue;
    }
    let content;
    try {
      content = readFileSync(full, "utf8");
    } catch {
      continue; // binary / unreadable -> skip content scan
    }
    for (const p of patterns) {
      if (p.re.test(content)) leaks.push(`secret pattern "${p.name}" found in served asset: ${full}`);
    }
  }
}

if (!existsSync(SERVED_DIR)) {
  console.error(`check-deploy-assets: served dir ${SERVED_DIR} does not exist — run the build first.`);
  process.exit(1);
}

walk(SERVED_DIR);

if (leaks.length > 0) {
  console.error("\n❌ Deploy blocked — secrets or Worker artifacts would be published as public assets:\n");
  for (const l of leaks) console.error(`   - ${l}`);
  console.error(
    "\nFix wrangler.jsonc assets.directory (must be the browser-asset subdir, e.g. ./dist/client/client),\n" +
      "or add a .assetsignore, then rebuild. Do NOT deploy until this passes.\n"
  );
  process.exit(1);
}

console.log(`✅ check-deploy-assets: ${SERVED_DIR} is clean — no secrets or Worker artifacts in the served asset tree.`);
