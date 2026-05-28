import { defineConfig } from "vitest/config";
import path from "node:path";

// Base config — shared resolve aliases. The actual test projects (a jsdom
// "unit" project and a node "worker" project) are declared in
// vitest.workspace.ts so `npm run test:worker` (--project worker) resolves.
export default defineConfig({
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@worker": path.resolve(__dirname, "src/worker"),
    },
  },
  test: {
    globals: false,
  },
});
