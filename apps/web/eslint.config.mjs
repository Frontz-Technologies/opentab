import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // False positive in App Router — this rule is for Pages Router _document.js
      "@next/next/no-page-custom-font": "off",
    },
  },
];

export default eslintConfig;
