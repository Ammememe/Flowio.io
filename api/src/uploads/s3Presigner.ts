import { randomUUID } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { AllowedImageContentType } from "@flowio/shared";
import type { PresignedUpload, UploadPresigner } from "./uploadPresigner.js";

/** P3-7: real presigned upload, enforced by S3 itself via the POST policy's conditions. */
export class S3UploadPresigner implements UploadPresigner {
  private readonly client: S3Client;

  constructor(
    private readonly bucketName: string,
    private readonly publicBaseUrl: string,
    client: S3Client = new S3Client({}),
  ) {
    this.client = client;
  }

  async createUploadUrl(
    ownerId: string,
    contentType: AllowedImageContentType,
    maxSizeBytes: number,
  ): Promise<PresignedUpload> {
    const extension = contentType.split("/")[1]?.replace("svg+xml", "svg") ?? "bin";
    const key = `${ownerId}/${randomUUID()}.${extension}`;

    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucketName,
      Key: key,
      Conditions: [
        ["content-length-range", 0, maxSizeBytes],
        ["eq", "$Content-Type", contentType],
      ],
      Fields: { "Content-Type": contentType },
      Expires: 300, // seconds
    });

    return {
      uploadUrl: url,
      method: "s3-post",
      fields,
      publicUrl: `${this.publicBaseUrl}/${key}`,
    };
  }
}
