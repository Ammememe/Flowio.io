import { ALLOWED_IMAGE_CONTENT_TYPES, isAllowedImageContentType, MAX_IMAGE_BYTES } from "@flowio/shared";
import { getAuthHeader } from "../auth/devAuth.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

interface PresignedUpload {
  uploadUrl: string;
  method: "s3-post" | "local-put";
  fields: Record<string, string>;
  publicUrl: string;
}

/** P3-7: pre-check so the user gets an immediate error instead of waiting on a round trip. */
export function validateImageFile(file: File): string | null {
  if (!isAllowedImageContentType(file.type)) {
    return `Unsupported file type. Allowed: ${ALLOWED_IMAGE_CONTENT_TYPES.join(", ")}`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `File too large: max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`;
  }
  return null;
}

/** Uploads `file` and returns the URL it will be servable from once the upload completes. */
export async function uploadImage(file: File): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const authHeader = getAuthHeader();
  const presignRes = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  });
  if (!presignRes.ok) {
    const body = await presignRes.json().catch(() => ({}));
    throw new Error(body.error ?? `Could not start upload: ${presignRes.status}`);
  }
  const presigned = (await presignRes.json()) as PresignedUpload;

  if (presigned.method === "local-put") {
    const putRes = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
  } else {
    const form = new FormData();
    // S3's presigned-POST parser requires `key` and the X-Amz-* control
    // fields in exactly this relative order, not interleaved with other
    // fields -- confirmed against the real deployed bucket. The SDK's
    // `fields` object does NOT return them in this order, and it only
    // matters when signed with temporary credentials (Lambda's, unlike a
    // long-lived IAM user's), which is why this only broke once deployed.
    const reservedOrder = [
      "key",
      "X-Amz-Credential",
      "X-Amz-Algorithm",
      "X-Amz-Date",
      "Policy",
      "X-Amz-Security-Token",
      "X-Amz-Signature",
    ];
    for (const [name, value] of Object.entries(presigned.fields)) {
      if (!reservedOrder.includes(name)) form.append(name, value);
    }
    for (const name of reservedOrder) {
      if (presigned.fields[name] !== undefined) form.append(name, presigned.fields[name]);
    }
    form.append("file", file);
    const postRes = await fetch(presigned.uploadUrl, { method: "POST", body: form });
    if (!postRes.ok) throw new Error(`Upload failed: ${postRes.status}`);
  }

  return presigned.publicUrl;
}
