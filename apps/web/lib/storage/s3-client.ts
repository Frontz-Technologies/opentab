import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: process.env.S3_REGION || "eu-west-1",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

export const BUCKET = process.env.S3_BUCKET || "opentab-uploads";

export const S3_PUBLIC_ENDPOINT =
  process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT;
