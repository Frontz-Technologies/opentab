import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");
const noUnscopedOrgQuery = require("./eslint-rules/no-unscoped-org-query.cjs");

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
];

export default eslintConfig;
