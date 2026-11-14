import { randomUUID } from "node:crypto";
import type { AllowedImageContentType } from "@flowio/shared";
import type { PresignedUpload, UploadPresigner } from "./uploadPresigner.js";

/**
 * Local stand-in for `S3UploadPresigner` (P3-7), used by the local dev
 * server. There's no S3/CloudFront deployed yet, so uploaded bytes just
 * live in memory for the lifetime of the dev server and are served back
 * from `GET /uploads/raw/:key` (see `localServer.ts`).
 */
export class LocalUploadPresigner implements UploadPresigner {
  readonly store = new Map<string, { contentType: string; data: Buffer }>();

  constructor(private readonly baseUrl: string) {}

  async createUploadUrl(
    ownerId: string,
    contentType: AllowedImageContentType,
    _maxSizeBytes: number,
  ): Promise<PresignedUpload> {
    const extension = contentType.split("/")[1]?.replace("svg+xml", "svg") ?? "bin";
    const key = `${ownerId}/${randomUUID()}.${extension}`;
    const url = `${this.baseUrl}/uploads/raw/${encodeURIComponent(key)}`;
    return {
      uploadUrl: url,
      method: "local-put",
      fields: {},
      publicUrl: url,
    };
  }
}
