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
    for (const [key, value] of Object.entries(presigned.fields)) form.append(key, value);
    form.append("file", file);
    const postRes = await fetch(presigned.uploadUrl, { method: "POST", body: form });
    if (!postRes.ok) throw new Error(`Upload failed: ${postRes.status}`);
  }

  return presigned.publicUrl;
}
