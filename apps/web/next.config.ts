import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const devOrigins = appUrl ? [new URL(appUrl).hostname] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  transpilePackages: ["@opentab/db"],
  serverExternalPackages: [
    "@sentry/node",
    "@opentelemetry/instrumentation",
    "require-in-the-middle",
    "@fastify/otel",
  ],
  async redirects() {
    return [
      {
        source: "/settings/company",
        destination: "/settings/organisation",
        permanent: true,
      },
      {
        source: "/settings/mydata",
        destination: "/settings/integrations/mydata",
        permanent: true,
      },
      {
        source: "/settings/ai",
        destination: "/settings/integrations/ai",
        permanent: true,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    // Ensure PostCSS runs before css-loader resolves @import "tailwindcss"
    config.module.rules.forEach((rule: any) => {
      if (rule.oneOf) {
        rule.oneOf.forEach((r: any) => {
          if (r.use && Array.isArray(r.use)) {
            r.use.forEach((use: any) => {
              if (use.loader?.includes("css-loader") && use.options) {
                use.options.importLoaders = 1;
              }
            });
          }
        });
      }
    });
    return config;
  },
};

export default withNextIntl(nextConfig);
