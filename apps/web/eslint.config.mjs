import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");
const noUnscopedOrgQuery = require("./eslint-rules/no-unscoped-org-query.cjs");
const boundaries = require("eslint-plugin-boundaries");

// Modules on the strict-list get the boundary rule at error level.
// Add a module here when its migration to the deep-module pattern lands.
// See docs/CONVENTIONS.md "Module Structure" (added in a later task).
//
// Note: business-lookup is intentionally NOT on the strict-list yet —
// it currently imports sub-paths of lib/country/ and lib/logging/ which
// haven't been migrated. Once those are migrated (or business-lookup is
// itself reshaped to use only their indexes), add it here.
const STRICT_LIB_MODULES = [
  "logging",
  "security",
  "sentry",
  "storage",
  "fx",
];

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // False positive in App Router — this rule is for Pages Router _document.js
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    plugins: {
      "cross-org-scope": {
        rules: {
          "no-unscoped-org-query": noUnscopedOrgQuery,
        },
      },
    },
    rules: {
      "cross-org-scope/no-unscoped-org-query": "error",
    },
    // Tests under __tests__/ legitimately exercise unscoped queries —
    // the cross-org/* specs intentionally insert from Org B and assert
    // the production action refuses them. Excluding the rule keeps the
    // signal-to-noise ratio of the lint pass meaningful.
    ignores: ["__tests__/**"],
  },
  // ============================================================
  // Deep-module boundary enforcement (#291) — eslint-plugin-boundaries v6
  // ============================================================
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "lib-module", pattern: "lib/*", mode: "folder" },
        { type: "app", pattern: "app/**", mode: "file" },
        { type: "components", pattern: "components/*", mode: "folder" },
        { type: "tests", pattern: "__tests__/**", mode: "file" },
      ],
      "boundaries/include": ["**/*.ts", "**/*.tsx", "**/*.mts"],
    },
    rules: {
      // Cross-module imports must go through the module's index.ts.
      // Warn level for all modules; strict-list modules get the same
      // rule at error level in the next config block.
      "boundaries/dependencies": [
        "warn",
        {
          default: "allow",
          rules: [
            {
              from: { type: ["app", "components"] },
              disallow: {
                to: { type: "lib-module", internalPath: "!index.ts" },
              },
              message:
                "Cross-module imports must go through the module's index.ts. See docs/CONVENTIONS.md 'Module Structure'.",
            },
            {
              from: { type: "lib-module" },
              disallow: {
                to: { type: "lib-module", internalPath: "!index.ts" },
              },
              message:
                "Cross-module imports must go through the module's index.ts. See docs/CONVENTIONS.md 'Module Structure'.",
            },
          ],
        },
      ],
    },
  },
  // Strict block: errors for files inside the strict-list modules.
  {
    files: STRICT_LIB_MODULES.flatMap((m) => [
      `lib/${m}/**/*.ts`,
      `lib/${m}/**/*.tsx`,
    ]),
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: { type: "lib-module" },
              disallow: {
                to: { type: "lib-module", internalPath: "!index.ts" },
              },
              message:
                "Cross-module imports must go through the module's index.ts (strict module).",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
