/**
 * Object storage adapter (S3 / S3-compatible). The single shared `s3Client`
 * is constructed from environment variables at import time; consumers use it
 * for upload/download/presign operations against `BUCKET`.
 */
export { s3Client, BUCKET, S3_PUBLIC_ENDPOINT } from "./s3-client";
