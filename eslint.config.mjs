import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Vendored from the Animate UI registry (shadcn CLI); kept as published.
    "components/animate-ui/**",
    "hooks/use-auto-height.tsx",
    "hooks/use-controlled-state.tsx",
    "hooks/use-is-in-view.tsx",
    "lib/get-strict-context.tsx",
  ]),
]);

export default eslintConfig;
