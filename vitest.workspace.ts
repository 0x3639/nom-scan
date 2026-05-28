import { defineWorkspace } from "vitest/config";

// Two projects:
//  - "unit":   jsdom env for shared/app pure logic and React-adjacent code.
//  - "worker": node env for Worker code; loads a minimal Cache API polyfill so
//              withCache-based handlers run without the full workerd pool.
// `npm test` runs both; `npm run test:worker` runs only the worker project.
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "unit",
      environment: "jsdom",
      include: [
        "tests/unit/**/*.test.ts",
        "src/shared/**/*.test.ts",
        "src/app/**/*.test.{ts,tsx}",
      ],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "worker",
      environment: "node",
      setupFiles: ["./tests/worker/setup.ts"],
      include: ["src/worker/**/*.test.ts", "tests/worker/**/*.test.ts"],
    },
  },
]);
