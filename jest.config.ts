import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "./tsconfig.test.json",
        // Ignore type-only errors in transitive deps (e.g. zod v3/v4 type conflict
        // in zod-to-json-schema) that do not affect runtime correctness
        diagnostics: {
          ignoreCodes: ["TS2589", "TS2345"],
        },
      },
    ],
  },
  transformIgnorePatterns: [
    // Transform ESM-only packages that Jest cannot handle as-is
    "/node_modules/(?!(radash|nanoid|p-limit|yocto-queue|ollama-ai-provider)/)",
  ],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  // Extend the default timeout — Ollama local inference is slow
  testTimeout: 30000,
};

export default config;
