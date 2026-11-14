import type { AllowedImageContentType } from "@flowio/shared";

/** What the client needs to actually perform the upload, whichever store backs it. */
export interface PresignedUpload {
  /** Where to send the file. */
  uploadUrl: string;
  /** "s3" posts a multipart form with `fields` plus the file; "local" PUTs the raw bytes. */
  method: "s3-post" | "local-put";
  /** Extra form fields required by an S3 presigned POST. Empty for local-put. */
  fields: Record<string, string>;
  /** Where the uploaded file will be readable from once the upload completes. */
  publicUrl: string;
}

export interface UploadPresigner {
  createUploadUrl(
    ownerId: string,
    contentType: AllowedImageContentType,
    maxSizeBytes: number,
  ): Promise<PresignedUpload>;
}
